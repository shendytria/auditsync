package helpers

import (
	"context"
	"fmt"
	"log"
	"net/smtp"
	"os"

	"github.com/vaneshadhani/e-audit-backend/config"
)

//////////////////////////////////////////////////////
// ================= CORE EMAIL =====================
//////////////////////////////////////////////////////

func sendSMTPEmail(to, subject, body string, isHTML bool) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	from := os.Getenv("SMTP_SENDER")

	contentType := "text/plain"
	if isHTML {
		contentType = "text/html"
	}

	headers := ""
	headers += "From: AuditSync <" + from + ">\r\n"
	headers += "To: " + to + "\r\n"
	headers += "Subject: " + subject + "\r\n"
	headers += "MIME-Version: 1.0\r\n"
	headers += "Content-Type: " + contentType + "; charset=UTF-8\r\n\r\n"

	message := []byte(headers + body)

	// SMTP Relay (NO AUTH)
	var auth smtp.Auth = nil

	err := smtp.SendMail(
		smtpHost+":"+smtpPort,
		auth,
		from,
		[]string{to},
		message,
	)

	if err != nil {
		log.Println("❌ Email gagal:", err)
		return err
	}

	log.Println("✅ Email terkirim ke:", to)
	return nil
}

//////////////////////////////////////////////////////
// ================= EMAIL FUNCTIONS =================
//////////////////////////////////////////////////////

// 🔐 Reset Password
func SendResetEmail(to string, token string) error {
	resetLink := fmt.Sprintf("https://your-domain.com/reset-password?token=%s", token)

	body := fmt.Sprintf(`
	<html>
	<body style="font-family: Arial; background:#f4f6f8; padding:20px;">
		<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;border:1px solid #ddd;">
			<div style="background:#1e3a8a;color:white;padding:16px;text-align:center;">
				<h2>AuditSync System</h2>
			</div>

			<div style="padding:20px;">
				<p>Halo,</p>
				<p>Silakan klik tombol berikut untuk reset password:</p>

				<div style="text-align:center;margin:30px 0;">
					<a href="%s" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">
						Reset Password
					</a>
				</div>

				<p style="font-size:12px;color:#888;">
					Link berlaku 1 jam.<br/>
					%s
				</p>
			</div>
		</div>
	</body>
	</html>
	`, resetLink, resetLink)

	return sendSMTPEmail(to, "Reset Password - AuditSync", body, true)
}

// 📋 Assignment Audit
func SendAuditAssignedEmail(to, auditorName, site, jenisAudit, area, tanggalAudit string) error {
	body := fmt.Sprintf(`
	<div style="font-family: Arial; padding:20px;">
		<h2>Halo, %s 👋</h2>
		<p>Anda ditugaskan untuk audit:</p>

		<ul>
			<li><b>Site:</b> %s</li>
			<li><b>Jenis:</b> %s</li>
			<li><b>Area:</b> %s</li>
		</ul>

		<p>Mulai tanggal: <b>%s</b></p>

		<a href="https://your-domain.com/login">Mulai Audit</a>
	</div>
	`, auditorName, site, jenisAudit, area, tanggalAudit)

	return sendSMTPEmail(to, "Penugasan Audit Baru - AuditSync", body, true)
}

// 👀 QS Review
func SendQSReviewNotification(to, nama, auditID string) error {
	body := fmt.Sprintf(`
Halo %s,

Audit dengan ID %s menunggu review Anda.

Silakan login ke sistem.

Terima kasih.
`, nama, auditID)

	return sendSMTPEmail(to, "Audit Menunggu Review", body, false)
}

// 📌 Assign PIC
func SendAssignPICNotification(to, nama string, auditID uint64) error {
	body := fmt.Sprintf(`
Halo %s,

Anda ditunjuk sebagai PIC untuk audit ID %d.

Segera lakukan CAPA.

Terima kasih.
`, nama, auditID)

	return sendSMTPEmail(to, "Penugasan PIC Audit", body, false)
}

// ❌ Rejected Audit
func SendAuditRejectedNotification(to, nama, reason string) error {
	body := fmt.Sprintf(`
Halo %s,

Audit Anda direvisi.

Alasan:
%s

Silakan perbaiki.

Terima kasih.
`, nama, reason)

	return sendSMTPEmail(to, "Audit Direvisi", body, false)
}

// 👔 Manager Approval
func SendManagerAreaNotification(to, nama, auditID string) error {
	body := fmt.Sprintf(`
Halo %s,

Audit ID %s membutuhkan approval Anda.

Silakan login ke sistem.

Terima kasih.
`, nama, auditID)

	return sendSMTPEmail(to, "Approval Audit Manager Area", body, false)
}

//////////////////////////////////////////////////////
// ============ DB + EMAIL INTEGRATION ==============
//////////////////////////////////////////////////////

func SendNextApprovalNotification(userID int, pelaksanaanID string, role string) {
	ctx := context.Background()

	var email, nama string
	err := config.DB.QueryRow(ctx, `
		SELECT email, nama_lengkap 
		FROM users 
		WHERE user_id = $1
	`, userID).Scan(&email, &nama)

	if err != nil {
		log.Println("❌ Gagal ambil user:", err)
		return
	}

	if email == "" {
		log.Println("⚠️ Email kosong, skip kirim")
		return
	}

	body := fmt.Sprintf(`
Halo %s,

Audit dengan ID %s membutuhkan approval Anda sebagai %s.

Silakan login ke sistem E-Audit.

Terima kasih.
`, nama, pelaksanaanID, role)

	err = sendSMTPEmail(email, "Approval Audit Menunggu Tindakan Anda", body, false)
	if err != nil {
		log.Println("❌ Gagal kirim email:", err)
	}
}

// Ambil semua approver
func GetNextApproverIDs(pelaksanaanID string) (qsSpv, mgrArea, mgrQs int, err error) {
	ctx := context.Background()

	err = config.DB.QueryRow(ctx, `
		SELECT approver_qs_spv_id, approver_mgr_area_id, approver_mgr_qs_id
		FROM pelaksanaan_audit
		WHERE pelaksanaan_id = $1
	`, pelaksanaanID).Scan(&qsSpv, &mgrArea, &mgrQs)

	return
}
