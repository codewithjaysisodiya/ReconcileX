package com.reconcilex.servlet;

import com.reconcilex.dao.ReconciliationDAO;
import com.reconcilex.dao.TransactionDAO;
import com.reconcilex.model.ReconciledTransaction;
import com.reconcilex.model.ReconciliationSession;

import java.io.IOException;
import java.sql.Date;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * ReconciliationServlet
 * Core Financial Reconciliation Engine Servlet.
 * Handles reconciliation persistence, transaction auditing, tolerance calculations,
 * and session retrieval.
 * Mapped to /api/reconciliation and /ReconciliationServlet
 */
public class ReconciliationServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String sessionIdStr = req.getParameter("sessionId");
        if (sessionIdStr == null || sessionIdStr.isEmpty()) {
            sessionIdStr = req.getParameter("id");
        }

        try {
            if (sessionIdStr != null && !sessionIdStr.isEmpty()) {
                int sessionId = Integer.parseInt(sessionIdStr);
                List<ReconciledTransaction> txns = TransactionDAO.getTransactionsBySession(sessionId);
                StringBuilder sb = new StringBuilder("{\"success\":true,\"sessionId\":").append(sessionId).append(",\"transactions\":[");
                for (int i = 0; i < txns.size(); i++) {
                    sb.append(txns.get(i).toJson());
                    if (i < txns.size() - 1) sb.append(",");
                }
                sb.append("]}");
                sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
            } else {
                List<ReconciliationSession> list = ReconciliationDAO.getRecentSessions(30);
                StringBuilder sb = new StringBuilder("{\"success\":true,\"sessions\":[");
                for (int i = 0; i < list.size(); i++) {
                    sb.append(list.get(i).toJson());
                    if (i < list.size() - 1) sb.append(",");
                }
                sb.append("]}");
                sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
            }
        } catch (Exception e) {
            sendJsonResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();

        try {
            ReconciliationSession s = new ReconciliationSession();
            String code = extractJsonString(body, "sessionCode");
            if (code.isEmpty()) {
                code = "REC-" + System.currentTimeMillis();
            }
            s.setSessionCode(code);
            s.setBankFileName(extractJsonString(body, "bankFileName"));
            s.setCompanyFileName(extractJsonString(body, "companyFileName"));
            s.setTotalProcessed(extractJsonInt(body, "totalProcessed", 0));
            s.setMatchedCount(extractJsonInt(body, "matchedCount", 0));
            s.setUnmatchedCount(extractJsonInt(body, "unmatchedCount", 0));
            s.setMismatchCount(extractJsonInt(body, "mismatchCount", 0));
            s.setDuplicateCount(extractJsonInt(body, "duplicateCount", 0));
            s.setMatchPercentage(extractJsonDouble(body, "matchPercentage", 0.0));
            s.setTotalDiscrepancy(extractJsonDouble(body, "totalDiscrepancy", 0.0));
            s.setNetVariance(extractJsonDouble(body, "netVariance", 0.0));

            int sessionId = ReconciliationDAO.saveSession(s);

            // Parse optional transactions array in the body
            List<ReconciledTransaction> txns = parseTransactionsFromJson(body, sessionId);
            if (!txns.isEmpty()) {
                TransactionDAO.saveTransactionsBatch(sessionId, txns);
            }

            String response = "{\"success\":true,\"sessionId\":" + sessionId + ",\"sessionCode\":\"" + code + "\",\"transactionsSaved\":" + txns.size() + "}";
            sendJsonResponse(resp, HttpServletResponse.SC_CREATED, response);
        } catch (Exception e) {
            String error = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Reconciliation persistence error.";
            sendJsonResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "{\"error\":\"" + error + "\"}");
        }
    }

    private List<ReconciledTransaction> parseTransactionsFromJson(String json, int sessionId) {
        List<ReconciledTransaction> list = new ArrayList<>();
        int arrayStart = json.indexOf("\"transactions\"");
        if (arrayStart == -1) return list;

        int openBracket = json.indexOf("[", arrayStart);
        int closeBracket = json.lastIndexOf("]");
        if (openBracket == -1 || closeBracket <= openBracket) return list;

        String arrayContent = json.substring(openBracket + 1, closeBracket).trim();
        if (arrayContent.isEmpty()) return list;

        Pattern objPattern = Pattern.compile("\\{([^}]+)\\}");
        Matcher objMatcher = objPattern.matcher(arrayContent);

        int idx = 1;
        while (objMatcher.find()) {
            String objStr = "{" + objMatcher.group(1) + "}";
            ReconciledTransaction t = new ReconciledTransaction();
            t.setSessionId(sessionId);
            t.setOccurrenceIndex(idx++);
            t.setTransactionId(extractJsonString(objStr, "transaction_id"));
            if (t.getTransactionId().isEmpty()) {
                t.setTransactionId(extractJsonString(objStr, "transactionId"));
            }

            double bAmt = extractJsonDouble(objStr, "bank_amount", Double.NaN);
            if (Double.isNaN(bAmt)) bAmt = extractJsonDouble(objStr, "bankAmount", Double.NaN);
            if (!Double.isNaN(bAmt)) t.setBankAmount(bAmt);

            double cAmt = extractJsonDouble(objStr, "company_amount", Double.NaN);
            if (Double.isNaN(cAmt)) cAmt = extractJsonDouble(objStr, "companyAmount", Double.NaN);
            if (!Double.isNaN(cAmt)) t.setCompanyAmount(cAmt);

            t.setDifference(extractJsonDouble(objStr, "difference", 0.0));

            String bDate = extractJsonString(objStr, "bank_date");
            if (bDate.isEmpty()) bDate = extractJsonString(objStr, "bankDate");
            if (!bDate.isEmpty()) {
                try { t.setBankDate(Date.valueOf(bDate)); } catch (Exception ignored) {}
            }

            String cDate = extractJsonString(objStr, "company_date");
            if (cDate.isEmpty()) cDate = extractJsonString(objStr, "companyDate");
            if (!cDate.isEmpty()) {
                try { t.setCompanyDate(Date.valueOf(cDate)); } catch (Exception ignored) {}
            }

            t.setStatus(extractJsonString(objStr, "status"));
            t.setBankDescription(extractJsonString(objStr, "bank_description"));
            t.setCompanyDescription(extractJsonString(objStr, "company_description"));
            t.setBankReference(extractJsonString(objStr, "bank_reference"));
            t.setCompanyReference(extractJsonString(objStr, "company_reference"));
            t.setAuditNotes(extractJsonString(objStr, "audit_notes"));

            list.add(t);
        }
        return list;
    }
}
