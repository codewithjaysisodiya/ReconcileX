package com.reconcilex.servlet;

import java.io.IOException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * DuplicateDetectionServlet
 * Identifies duplicate transactions, repeated IDs, and collision clusters
 * across uploaded bank statements and company ledgers.
 * Mapped to /api/duplicates and /DuplicateDetectionServlet
 */
public class DuplicateDetectionServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();

        // Extract transaction list from JSON
        List<Map<String, String>> rawTxns = extractTxnList(body);

        Map<String, List<Map<String, String>>> idMap = new HashMap<>();
        Map<String, List<Map<String, String>>> amountDateMap = new HashMap<>();

        for (Map<String, String> txn : rawTxns) {
            String id = txn.get("transaction_id");
            if (id != null && !id.isEmpty()) {
                idMap.computeIfAbsent(id.toLowerCase(), k -> new ArrayList<>()).add(txn);
            }

            String date = txn.get("date");
            String amt = txn.get("amount");
            if (date != null && !date.isEmpty() && amt != null && !amt.isEmpty()) {
                String key = date + "|" + amt;
                amountDateMap.computeIfAbsent(key, k -> new ArrayList<>()).add(txn);
            }
        }

        List<Map<String, Object>> detectedDuplicates = new ArrayList<>();

        // 1. Exact ID duplicates
        for (Map.Entry<String, List<Map<String, String>>> entry : idMap.entrySet()) {
            if (entry.getValue().size() > 1) {
                Map<String, Object> dup = new LinkedHashMap<>();
                dup.put("type", "EXACT_TRANSACTION_ID_DUPLICATE");
                dup.put("identifier", entry.getKey());
                dup.put("occurrences", entry.getValue().size());
                dup.put("records", entry.getValue());
                detectedDuplicates.add(dup);
            }
        }

        // 2. Amount and Date collision duplicates
        for (Map.Entry<String, List<Map<String, String>>> entry : amountDateMap.entrySet()) {
            if (entry.getValue().size() > 1) {
                // Ensure they aren't already flagged under identical id
                Set<String> uniqueIds = new HashSet<>();
                for (Map<String, String> row : entry.getValue()) {
                    uniqueIds.add(row.get("transaction_id"));
                }
                if (uniqueIds.size() > 1) {
                    Map<String, Object> dup = new LinkedHashMap<>();
                    dup.put("type", "POTENTIAL_DOUBLE_BILLING_AMOUNT_DATE");
                    dup.put("identifier", entry.getKey());
                    dup.put("occurrences", entry.getValue().size());
                    dup.put("records", entry.getValue());
                    detectedDuplicates.add(dup);
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"success\":true,\"totalAnalyzed\":").append(rawTxns.size()).append(",");
        sb.append("\"duplicateCount\":").append(detectedDuplicates.size()).append(",");
        sb.append("\"duplicates\":[");

        for (int i = 0; i < detectedDuplicates.size(); i++) {
            Map<String, Object> dup = detectedDuplicates.get(i);
            sb.append("{");
            sb.append("\"type\":\"").append(dup.get("type")).append("\",");
            sb.append("\"identifier\":\"").append(escapeJson((String) dup.get("identifier"))).append("\",");
            sb.append("\"occurrences\":").append(dup.get("occurrences"));
            sb.append("}");
            if (i < detectedDuplicates.size() - 1) sb.append(",");
        }
        sb.append("]}");

        sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
    }

    private List<Map<String, String>> extractTxnList(String json) {
        List<Map<String, String>> list = new ArrayList<>();
        Pattern objPat = Pattern.compile("\\{([^}]+)\\}");
        Matcher objMat = objPat.matcher(json);

        while (objMat.find()) {
            String objStr = "{" + objMat.group(1) + "}";
            String id = extractJsonString(objStr, "transaction_id");
            if (id.isEmpty()) id = extractJsonString(objStr, "transactionId");
            if (id.isEmpty()) id = extractJsonString(objStr, "reference");

            String date = extractJsonString(objStr, "date");
            double amt = extractJsonDouble(objStr, "amount", Double.NaN);

            if (!id.isEmpty() || !Double.isNaN(amt)) {
                Map<String, String> map = new HashMap<>();
                map.put("transaction_id", id);
                map.put("date", date);
                map.put("amount", Double.isNaN(amt) ? "0.0" : String.valueOf(amt));
                map.put("description", extractJsonString(objStr, "description"));
                list.add(map);
            }
        }
        return list;
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}
