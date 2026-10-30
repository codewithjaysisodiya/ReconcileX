package com.reconcilex.servlet;

import com.reconcilex.dao.TransactionDAO;
import com.reconcilex.model.ReconciledTransaction;

import java.io.IOException;
import java.util.List;

/**
 * AuditServlet
 * Compliance, Maker-Checker sign-off, and discrepancy audit management.
 * Mapped to /api/audit and /AuditServlet
 */
public class AuditServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String sessionIdStr = req.getParameter("sessionId");
        if (sessionIdStr == null || sessionIdStr.isEmpty()) {
            sessionIdStr = req.getParameter("id");
        }

        if (sessionIdStr == null || sessionIdStr.isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Missing sessionId parameter for audit queries.\"}");
            return;
        }

        try {
            int sessionId = Integer.parseInt(sessionIdStr);
            List<ReconciledTransaction> discrepancies = TransactionDAO.getDiscrepancies(sessionId);

            StringBuilder sb = new StringBuilder();
            sb.append("{\"success\":true,\"sessionId\":").append(sessionId).append(",\"discrepancyCount\":").append(discrepancies.size()).append(",\"discrepancies\":[");
            for (int i = 0; i < discrepancies.size(); i++) {
                sb.append(discrepancies.get(i).toJson());
                if (i < discrepancies.size() - 1) sb.append(",");
            }
            sb.append("]}");

            sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
        } catch (NumberFormatException e) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Invalid sessionId format.\"}");
        } catch (Exception e) {
            sendJsonResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        handleAuditUpdate(req, resp);
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        handleAuditUpdate(req, resp);
    }

    private void handleAuditUpdate(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = req.getBody();
        String transactionId = extractJsonString(body, "transactionId");
        if (transactionId.isEmpty()) {
            transactionId = extractJsonString(body, "transaction_id");
        }
        if (transactionId.isEmpty()) {
            transactionId = req.getParameter("transactionId");
        }

        String notes = extractJsonString(body, "auditNotes");
        if (notes.isEmpty()) {
            notes = extractJsonString(body, "notes");
        }
        if (notes.isEmpty()) {
            notes = req.getParameter("notes");
        }

        if (transactionId == null || transactionId.isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Missing transactionId for audit update.\"}");
            return;
        }

        boolean updated = TransactionDAO.updateAuditNotes(transactionId, notes != null ? notes : "");
        if (updated) {
            sendJsonResponse(resp, HttpServletResponse.SC_OK, "{\"success\":true,\"transactionId\":\"" + transactionId + "\",\"status\":\"AUDIT_NOTES_UPDATED\"}");
        } else {
            sendJsonResponse(resp, HttpServletResponse.SC_NOT_FOUND, "{\"error\":\"Transaction ID not found for audit update.\"}");
        }
    }
}
