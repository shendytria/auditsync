package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
	"github.com/vaneshadhani/e-audit-backend/utils"
)

type LoginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type CreateUserInput struct {
	Username     string `json:"username" binding:"required"`
	Password     string `json:"password" binding:"required"`
	NamaLengkap  string `json:"nama_lengkap" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	RoleID       int    `json:"role_id" binding:"required"`
	SiteID       int    `json:"site_id" binding:"required"`
	DepartmentID int    `json:"department_id" binding:"required"`
}

type Role struct {
	ID       int    `json:"id"`
	NamaRole string `json:"nama_role"`
}

type ForgotPasswordInput struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordInput struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// --- HELPER KECIL UNTUK AMBIL ID ACTOR (ADMIN) ---
func getActorID(c *gin.Context) string {
	// Coba ambil "user_id" (standar middleware)
	if val, exists := c.Get("user_id"); exists {
		return fmt.Sprintf("%v", val)
	}
	// Coba ambil "userID" (alternatif)
	if val, exists := c.Get("userID"); exists {
		return fmt.Sprintf("%v", val)
	}
	return "0"
}

func GetAllRoles(c *gin.Context) {
	var roles []Role

	rows, err := config.DB.Query(context.Background(), "SELECT id, nama_role FROM role ORDER BY nama_role")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data roles"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var role Role
		if err := rows.Scan(&role.ID, &role.NamaRole); err != nil {
			log.Printf("Gagal scan role: %v", err)
			continue
		}
		roles = append(roles, role)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saat iterasi data roles"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roles})
}

func LoginController(c *gin.Context) {
	var input LoginInput
	var user models.User
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	query := `SELECT 
                u.user_id, u.username, u.password_hash, u.email, u.nama_lengkap, 
                u.role_id, r.nama_role as jabatan, u.site_id
              FROM users u
              LEFT JOIN role r ON u.role_id = r.id
              WHERE u.username = $1`

	err := config.DB.QueryRow(context.Background(), query, input.Username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Email,
		&user.NamaLengkap,
		&user.RoleID,
		&user.Jabatan,
		&user.SiteID,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data user: " + err.Error()})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
		return
	}

	token, err := utils.GenerateToken(int64(user.ID), user.Jabatan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token"})
		return
	}

	// === [AUDIT LOG] LOGIN ===
	// Disini kita pass ID manual karena Login belum lewat middleware
	c.Set("user_id", strconv.Itoa(int(user.ID))) // Samakan key dengan middleware
	helpers.CreateAuditLog(c, "LOGIN", "Auth", fmt.Sprint(user.ID), nil, map[string]interface{}{
		"username": user.Username,
		"status":   "Success",
	}, fmt.Sprint(user.ID))

	isDefaultPassword := (input.Password == "Bintang7")

	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil",
		"token":   token,
		"user": gin.H{
			"id":                  user.ID,
			"username":            user.Username,
			"email":               user.Email,
			"nama_lengkap":        user.NamaLengkap,
			"jabatan":             user.Jabatan,
			"site_id":             user.SiteID,
			"role":                user.Jabatan,
			"is_default_password": isDefaultPassword,
		},
	})
}

type UserResponse struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	NamaLengkap string `json:"nama_lengkap"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	Site        string `json:"site"`
	Department  string `json:"department"`
}

func GetUsers(c *gin.Context) {
	ctx := context.Background()
	siteID := c.Query("site_id")
	role := c.Query("role")
	searchQuery := c.Query("search")

	sqlQuery := `
        SELECT 
            u.user_id,
            u.username,
            u.nama_lengkap,
            u.email,
            r.nama_role AS role,
            COALESCE(s.nama_site, '-') AS site,
			COALESCE(d.nama_department,'-') AS department
        FROM 
            users u
        LEFT JOIN 
            site s ON u.site_id = s.site_id
        LEFT JOIN
            role r ON u.role_id = r.id
		LEFT JOIN 
			department d ON u.department_id = d.department_id	
        WHERE 1=1
    `
	var args []interface{}
	argCount := 1
	if siteID != "" {
		sqlQuery += fmt.Sprintf(" AND u.site_id = $%d", argCount)
		args = append(args, siteID)
		argCount++
	}
	if role != "" {
		sqlQuery += fmt.Sprintf(" AND r.nama_role = $%d", argCount)
		args = append(args, role)
		argCount++
	}
	if searchQuery != "" {
		sqlQuery += fmt.Sprintf(" AND (u.username ILIKE $%d OR u.nama_lengkap ILIKE $%d)", argCount, argCount+1)
		args = append(args, "%"+searchQuery+"%", "%"+searchQuery+"%")
		argCount += 2
	}
	sqlQuery += " ORDER BY u.nama_lengkap"

	rows, err := config.DB.Query(ctx, sqlQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data users: " + err.Error()})
		return
	}
	defer rows.Close()

	var users []UserResponse
	for rows.Next() {
		var user UserResponse
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.NamaLengkap,
			&user.Email,
			&user.Role,
			&user.Site,
			&user.Department,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data user: " + err.Error()})
			return
		}
		users = append(users, user)
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func CreateUser(c *gin.Context) {
	var input CreateUserInput
	ctx := context.Background()

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses password"})
		return
	}

	sqlInsert := `
        INSERT INTO users (username, password_hash, nama_lengkap, email, role_id, site_id, department_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING user_id
    `
	var userID uint
	err = config.DB.QueryRow(ctx, sqlInsert,
		input.Username,
		hashedPassword,
		input.NamaLengkap,
		input.Email,
		input.RoleID,
		input.SiteID,
		input.DepartmentID,
	).Scan(&userID)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "users_username_key") {
				c.JSON(http.StatusConflict, gin.H{"error": "Username sudah terdaftar"})
				return
			}
			if strings.Contains(pgErr.ConstraintName, "users_email_key") {
				c.JSON(http.StatusConflict, gin.H{"error": "Email sudah terdaftar"})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan user baru: " + err.Error()})
		return
	}

	// === [AUDIT LOG] CREATE ===
	// [FIX]: Ambil ID Admin dari context dan kirim manual sebagai parameter terakhir
	actorID := getActorID(c)
	logInput := input
	logInput.Password = "[HIDDEN]"
	helpers.CreateAuditLog(c, "CREATE", "User", strconv.Itoa(int(userID)), nil, logInput, actorID)

	c.JSON(http.StatusOK, gin.H{"message": "User berhasil ditambahkan", "user_id": userID})
}

// --- FUNGSI 'EDIT USER' (GET DATA) ---
func GetAUser(c *gin.Context) {
	ctx := context.Background()
	userID := c.Param("id")

	var user struct {
		ID           uint   `json:"id"`
		Username     string `json:"username"`
		NamaLengkap  string `json:"nama_lengkap"`
		Email        string `json:"email"`
		RoleID       int    `json:"role_id"`
		SiteID       int    `json:"site_id"`
		DepartmentID *int   `json:"department_id"`
	}

	sqlQuery := `
        SELECT 
            user_id, 
            username, 
            nama_lengkap, 
            email, 
            role_id, 
            site_id, 
            department_id
        FROM users
        WHERE user_id = $1
    `

	err := config.DB.QueryRow(ctx, sqlQuery, userID).Scan(
		&user.ID,
		&user.Username,
		&user.NamaLengkap,
		&user.Email,
		&user.RoleID,
		&user.SiteID,
		&user.DepartmentID,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data user: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

type UpdateUserInput struct {
	Username     string `json:"username" binding:"required"`
	NamaLengkap  string `json:"nama_lengkap" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	RoleID       int    `json:"role_id" binding:"required"`
	SiteID       int    `json:"site_id" binding:"required"`
	DepartmentID int    `json:"department_id" binding:"required"`
}

// --- FUNGSI 'EDIT USER' (SIMPAN DATA) ---
func UpdateUser(c *gin.Context) {
	ctx := context.Background()
	userID := c.Param("id")

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA LAMA
	var oldData UpdateUserInput
	sqlGetOld := `SELECT username, nama_lengkap, email, role_id, site_id, department_id FROM users WHERE user_id = $1`
	err := config.DB.QueryRow(ctx, sqlGetOld, userID).Scan(
		&oldData.Username,
		&oldData.NamaLengkap,
		&oldData.Email,
		&oldData.RoleID,
		&oldData.SiteID,
	)
	if err != nil {
		// Log error jika perlu
	}

	// 2. UPDATE DATABASE
	sqlUpdate := `
        UPDATE users
		SET username=$1, nama_lengkap=$2, email=$3, role_id=$4, site_id=$5, department_id=$6
		WHERE user_id=$7
		`
	cmdTag, err := config.DB.Exec(ctx, sqlUpdate,
		input.Username,
		input.NamaLengkap,
		input.Email,
		input.RoleID,
		input.SiteID,
		input.DepartmentID,
		userID,
	)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "users_username_key") {
				c.JSON(http.StatusConflict, gin.H{"error": "Username sudah terdaftar"})
				return
			}
			if strings.Contains(pgErr.ConstraintName, "users_email_key") {
				c.JSON(http.StatusConflict, gin.H{"error": "Email sudah terdaftar"})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui user: " + err.Error()})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// 3. [AUDIT LOG] UPDATE
	// [FIX]: Ambil ID Admin dari context dan kirim manual sebagai parameter terakhir
	actorID := getActorID(c)
	helpers.CreateAuditLog(c, "UPDATE", "User", userID, oldData, input, actorID)

	c.JSON(http.StatusOK, gin.H{"message": "User berhasil diperbarui"})
}

// DeleteUser menghapus user berdasarkan ID
func DeleteUser(c *gin.Context) {
	ctx := context.Background()
	userID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID User tidak valid"})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA SEBELUM DIHAPUS
	var deletedUser struct {
		Username    string
		NamaLengkap string
		Email       string
	}
	sqlGetDeleted := `SELECT username, nama_lengkap, email FROM users WHERE user_id = $1`
	_ = config.DB.QueryRow(ctx, sqlGetDeleted, userID).Scan(&deletedUser.Username, &deletedUser.NamaLengkap, &deletedUser.Email)

	// 2. HAPUS DATABASE
	sqlDelete := `DELETE FROM users WHERE user_id = $1`
	cmdTag, err := config.DB.Exec(ctx, sqlDelete, userID)

	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			c.JSON(http.StatusConflict, gin.H{"error": "Gagal menghapus: User ini masih terhubung ke data lain (audit/checklist)."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus user: " + err.Error()})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// 3. [AUDIT LOG] DELETE
	// [FIX]: Ambil ID Admin dari context dan kirim manual sebagai parameter terakhir
	actorID := getActorID(c)
	helpers.CreateAuditLog(c, "DELETE", "User", userID, deletedUser, nil, actorID)

	c.JSON(http.StatusOK, gin.H{"message": "User berhasil dihapus"})
}

// --- FUNGSI GANTI PASSWORD ---
type ChangePasswordInput struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

func ChangePassword(c *gin.Context) {
	ctx := context.Background()

	var targetUserID string

	userIDFromToken, exists := c.Get("user_id")
	if exists {
		targetUserID = fmt.Sprintf("%v", userIDFromToken)
	} else {
		targetUserID = c.Param("id")
	}

	if targetUserID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID tidak ditemukan"})
		return
	}

	var input ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	if len(input.NewPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password baru harus minimal 8 karakter"})
		return
	}
	var user models.User
	query := `SELECT user_id, password_hash FROM users WHERE user_id = $1`
	err := config.DB.QueryRow(ctx, query, targetUserID).Scan(&user.ID, &user.PasswordHash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	if !utils.CheckPasswordHash(input.OldPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Password lama salah"})
		return
	}

	newHashedPassword, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses password baru"})
		return
	}

	sqlUpdate := `UPDATE users SET password_hash = $1 WHERE user_id = $2`
	_, err = config.DB.Exec(ctx, sqlUpdate, newHashedPassword, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui password: " + err.Error()})
		return
	}

	actorID := getActorID(c)
	helpers.CreateAuditLog(c, "CHANGE_PASSWORD", "User", targetUserID, nil, nil, actorID)

	c.JSON(http.StatusOK, gin.H{"message": "Password berhasil diperbarui"})
}

func ForgotPassword(c *gin.Context) {
	ctx := context.Background()
	var input ForgotPasswordInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email tidak valid"})
		return
	}

	var user models.User
	query := `SELECT user_id, email FROM users WHERE email = $1`
	err := config.DB.QueryRow(ctx, query, input.Email).Scan(&user.ID, &user.Email)

	if err != nil {
		// ❗ Jangan kasih tau email ada/tidak (security)
		c.JSON(http.StatusOK, gin.H{"message": "Jika email terdaftar, link reset akan dikirim"})
		return
	}

	// 🔐 generate token
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)

	expiry := time.Now().Add(1 * time.Hour)

	// 💾 simpan token
	sqlUpdate := `
		UPDATE users 
		SET reset_token = $1, reset_token_expiry = $2 
		WHERE user_id = $3
	`
	_, err = config.DB.Exec(ctx, sqlUpdate, token, expiry, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan token"})
		return
	}

	// 📩 kirim email
	err = helpers.SendResetEmail(user.Email, token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Link reset password telah dikirim ke email"})
}

func ResetPassword(c *gin.Context) {
	ctx := context.Background()
	var input ResetPasswordInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid"})
		return
	}

	var user models.User
	query := `
		SELECT user_id, reset_token_expiry 
		FROM users 
		WHERE reset_token = $1
	`

	err := config.DB.QueryRow(ctx, query, input.Token).Scan(
		&user.ID,
		&user.ResetTokenExpiry,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token tidak valid"})
		return
	}

	// ⏰ cek expired
	if time.Now().After(user.ResetTokenExpiry) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token sudah expired"})
		return
	}

	// 🔐 hash password baru
	hashedPassword, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hash password"})
		return
	}

	// 💾 update password + hapus token
	sqlUpdate := `
		UPDATE users 
		SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL
		WHERE user_id = $2
	`

	_, err = config.DB.Exec(ctx, sqlUpdate, hashedPassword, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update password"})
		return
	}

	actorID := fmt.Sprintf("%d", user.ID)
	helpers.CreateAuditLog(c, "RESET_PASSWORD", "User", actorID, nil, nil, actorID)

	c.JSON(http.StatusOK, gin.H{"message": "Password berhasil direset"})
}
