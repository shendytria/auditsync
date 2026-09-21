package models

import "time"

type User struct {
	ID               uint      `json:"id"`
	Username         string    `json:"username"`
	PasswordHash     string    `json:"-"`
	Email            string    `json:"email"`
	NamaLengkap      string    `json:"nama_lengkap"`
	RoleID           int       `json:"role_id"`
	Jabatan          string    `json:"jabatan"`
	SiteID           int       `json:"site_id"`
	DepartmentID     *int      `json:"department_id"`
	Department       string    `json:"department"`
	ResetToken       string    `json:"reset_token"`
	ResetTokenExpiry time.Time `json:"reset_token_expiry"`
}
