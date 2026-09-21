package helpers

import "github.com/vaneshadhani/e-audit-backend/models"

// MapStatusForFrontend mengubah status teknis DB menjadi teks yang ramah User
func MapStatusForFrontend(dbStatus string) string {
	switch dbStatus {
	// Modul 1: Pelaksanaan
	case models.StatusExecOpen, models.StatusRptOpen:
		return "Open"
	case models.StatusExecProgress, models.StatusRptProgress:
		return "In Progress"

	// Modul 2: Review QS
	case models.StatusQsReview:
		return "Submitted (Waiting QS Review)"
	case models.StatusRptRejectedPic:
		return "Revision (Returned by PIC)"
	case models.StatusQsRejectedMgr:
		return "Revision (Returned by Manager)"

	// Modul 3: CAPA
	case models.StatusCapaOpen:
		return "Open CAPA"
	case models.StatusCapaInProgress:
		return "CAPA In Progress"
	case models.StatusCapaRejectedQsSpv:
		return "Revision (Rejected by QS SPV)"

	// Modul 4: Approval Berjenjang
	case models.StatusWaitingQsSpv:
		return "WAITING QS SPV"
	case models.StatusWaitingMgrArea:
		return "WAITING MGR AREA"
	case models.StatusWaitingMgrQs:
		return "WAITING MGR QS"

	// Modul 5: Evidence & Closing
	case models.StatusReadyForCapa:
		return "Ready for Evidence"
	case models.StatusEvidenceProgress:
		return "Evidence In Progress"
	case models.StatusEvidenceVerif:
		return "Verification Process"
	case models.StatusEvidenceRevision:
		return "Evidence Revision"
	case models.StatusFinalClosing:
		return "Final Closing"
	case models.StatusClosed:
		return "CLOSED"

	default:
		return dbStatus
	}
}
