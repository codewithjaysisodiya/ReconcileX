package com.reconcilex.servlet;

import com.reconcilex.dao.ReconciliationDAO;
import com.reconcilex.model.ReconciliationSession;

import java.io.IOException;
import java.util.List;

/**
 * AnalyticsServlet
 * Computes business intelligence, match accuracy KPIs, discrepancy aggregation,
 * and reconciliation trends for analytical dashboards.
 * Mapped to /api/analytics and /AnalyticsServlet
 */
public class AnalyticsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            List<ReconciliationSession> sessions = ReconciliationDAO.getRecentSessions(50);

            int totalSessions = sessions.size();
            long totalProcessed = 0;
            long totalMatched = 0;
            long totalUnmatched = 0;
            long totalMismatches = 0;
            long totalDuplicates = 0;
            double cumulativeDiscrepancy = 0.0;

            for (ReconciliationSession s : sessions) {
                totalProcessed += s.getTotalProcessed();
                totalMatched += s.getMatchedCount();
                totalUnmatched += s.getUnmatchedCount();
                totalMismatches += s.getMismatchCount();
                totalDuplicates += s.getDuplicateCount();
                cumulativeDiscrepancy += Math.abs(s.getTotalDiscrepancy());
            }

            double overallMatchRate = totalProcessed > 0 ? ((double) totalMatched / totalProcessed) * 100.0 : 0.0;

            StringBuilder sb = new StringBuilder();
            sb.append("{");
            sb.append("\"success\":true,");
            sb.append("\"summary\":{");
            sb.append("\"totalSessions\":").append(totalSessions).append(",");
            sb.append("\"totalProcessed\":").append(totalProcessed).append(",");
            sb.append("\"totalMatched\":").append(totalMatched).append(",");
            sb.append("\"totalUnmatched\":").append(totalUnmatched).append(",");
            sb.append("\"totalMismatches\":").append(totalMismatches).append(",");
            sb.append("\"totalDuplicates\":").append(totalDuplicates).append(",");
            sb.append(String.format(java.util.Locale.US, "\"overallMatchRate\":%.2f,", overallMatchRate));
            sb.append(String.format(java.util.Locale.US, "\"cumulativeDiscrepancy\":%.2f", cumulativeDiscrepancy));
            sb.append("},");
            sb.append("\"sessions\":[");

            for (int i = 0; i < sessions.size(); i++) {
                sb.append(sessions.get(i).toJson());
                if (i < sessions.size() - 1) sb.append(",");
            }
            sb.append("]}");

            sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
        } catch (Exception e) {
            sendJsonResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
