package com.reconcilex.servlet;

import com.reconcilex.dao.TransactionDAO;
import com.reconcilex.model.ReconciledTransaction;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * ReportServlet
 * Generates audit compliance reports and downloadable CSV/JSON exports.
 * Mapped to /api/report and /ReportServlet
 */
public class ReportServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String sessionIdStr = req.getParameter("sessionId");
        if (sessionIdStr == null || sessionIdStr.isEmpty()) {
            sessionIdStr = req.getParameter("id");
        }

        if (sessionIdStr == null || sessionIdStr.isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Missing sessionId parameter for report generation.\"}");
            return;
        }

        int sessionId;
        try {
            sessionId = Integer.parseInt(sessionIdStr);
        } catch (NumberFormatException e) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Invalid sessionId format.\"}");
            return;
        }

        String format = req.getParameter("format");
        if (format == null || format.isEmpty()) format = "csv";

        List<ReconciledTransaction> transactions = TransactionDAO.getTransactionsBySession(sessionId);

        if ("json".equalsIgnoreCase(format)) {
            resp.setContentType("application/json; charset=UTF-8");
            StringBuilder sb = new StringBuilder("{\"sessionId\":").append(sessionId).append(",\"count\":").append(transactions.size()).append(",\"transactions\":[");
            for (int i = 0; i < transactions.size(); i++) {
                sb.append(transactions.get(i).toJson());
                if (i < transactions.size() - 1) sb.append(",");
            }
            sb.append("]}");
            resp.getWriter().print(sb.toString());
            resp.getWriter().flush();
            return;
        }

        // CSV Export
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("text/csv; charset=UTF-8");
        resp.setHeader("Content-Disposition", "attachment; filename=\"ReconcileX_Report_Session_" + sessionId + ".csv\"");

        PrintWriter out = resp.getWriter();
        out.println("Transaction ID,Status,Bank Date,Company Date,Bank Amount (INR),Company Amount (INR),Difference (INR),Bank Description,Company Description,Audit Notes");

        for (ReconciledTransaction t : transactions) {
            out.printf("\"%s\",\"%s\",\"%s\",\"%s\",%.2f,%.2f,%.2f,\"%s\",\"%s\",\"%s\"%n",
                escapeCsv(t.getTransactionId()),
                escapeCsv(t.getStatus()),
                t.getBankDate() != null ? t.getBankDate().toString() : "",
                t.getCompanyDate() != null ? t.getCompanyDate().toString() : "",
                t.getBankAmount() != null ? t.getBankAmount() : 0.0,
                t.getCompanyAmount() != null ? t.getCompanyAmount() : 0.0,
                t.getDifference(),
                escapeCsv(t.getBankDescription()),
                escapeCsv(t.getCompanyDescription()),
                escapeCsv(t.getAuditNotes())
            );
        }
        out.flush();
    }

    private String escapeCsv(String s) {
        if (s == null) return "";
        return s.replace("\"", "\"\"");
    }
}
