package com.reconcilex.servlet;

import java.io.IOException;
import java.util.*;

/**
 * CSVUploadServlet
 * Dedicated CSV statement processor with financial column mapping (Debit, Credit, Reference, Amount).
 * Mapped to /api/upload/csv and /CSVUploadServlet
 */
public class CSVUploadServlet extends UploadServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();
        String rawContent = extractJsonString(body, "content");
        if (rawContent.isEmpty()) {
            rawContent = body;
        }

        if (rawContent.trim().isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"CSV content is empty.\"}");
            return;
        }

        List<Map<String, String>> rawRecords = parseDelimitedContent(rawContent);
        List<Map<String, Object>> normalized = new ArrayList<>();

        for (Map<String, String> row : rawRecords) {
            Map<String, Object> record = new LinkedHashMap<>();

            // Flexible field discovery
            String txnId = findValue(row, "transaction_id", "txn_id", "bank_reference", "reference", "ref", "id");
            String date = findValue(row, "date", "txn_date", "transaction_date", "value_date");
            String desc = findValue(row, "narration", "description", "particulars", "memo", "details");
            String ref = findValue(row, "reference", "ref", "ref_no", "cheque_no", "utr");

            // Amount / Debit / Credit calculation
            double amount = 0.0;
            String amtStr = findValue(row, "amount", "amount_inr", "net_amount", "txn_amount");
            String debitStr = findValue(row, "debit", "debit_inr", "dr", "withdrawal");
            String creditStr = findValue(row, "credit", "credit_inr", "cr", "deposit");

            if (!amtStr.isEmpty()) {
                amount = parseDoubleSafe(amtStr);
            } else if (!debitStr.isEmpty() || !creditStr.isEmpty()) {
                double debit = parseDoubleSafe(debitStr);
                double credit = parseDoubleSafe(creditStr);
                if (credit > 0) amount = credit;
                else if (debit > 0) amount = -debit;
            }

            record.put("transaction_id", txnId.isEmpty() ? ("TXN-" + (normalized.size() + 1)) : txnId);
            record.put("date", date);
            record.put("amount", amount);
            record.put("description", desc);
            record.put("reference", ref);

            normalized.add(record);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"success\":true,\"format\":\"CSV\",\"count\":").append(normalized.size()).append(",\"transactions\":[");
        for (int i = 0; i < normalized.size(); i++) {
            Map<String, Object> map = normalized.get(i);
            sb.append("{");
            sb.append("\"transaction_id\":\"").append(escapeJson((String) map.get("transaction_id"))).append("\",");
            sb.append("\"date\":\"").append(escapeJson((String) map.get("date"))).append("\",");
            sb.append("\"amount\":").append(map.get("amount")).append(",");
            sb.append("\"description\":\"").append(escapeJson((String) map.get("description"))).append("\",");
            sb.append("\"reference\":\"").append(escapeJson((String) map.get("reference"))).append("\"");
            sb.append("}");
            if (i < normalized.size() - 1) sb.append(",");
        }
        sb.append("]}");

        sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
    }

    private String findValue(Map<String, String> row, String... keys) {
        for (String k : keys) {
            for (Map.Entry<String, String> entry : row.entrySet()) {
                String cleanHeader = entry.getKey().trim().toLowerCase().replaceAll("[^a-z0-9]", "");
                String cleanKey = k.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (cleanHeader.equals(cleanKey) || cleanHeader.contains(cleanKey)) {
                    if (entry.getValue() != null && !entry.getValue().trim().isEmpty()) {
                        return entry.getValue().trim();
                    }
                }
            }
        }
        return "";
    }

    private double parseDoubleSafe(String s) {
        if (s == null) return 0.0;
        try {
            return Double.parseDouble(s.replaceAll("[^0-9.-]", ""));
        } catch (Exception e) {
            return 0.0;
        }
    }
}
