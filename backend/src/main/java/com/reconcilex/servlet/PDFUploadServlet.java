package com.reconcilex.servlet;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PDFUploadServlet
 * Structured PDF bank statement parser extracting financial table records,
 * transaction references, dates, and amounts using pattern matching.
 * Mapped to /api/upload/pdf and /PDFUploadServlet
 */
public class PDFUploadServlet extends UploadServlet {

    private static final Pattern DATE_PATTERN = Pattern.compile("(\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{2}/\\d{2}/\\d{4}\\b|\\b\\d{2}-\\d{2}-\\d{4}\\b)");
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(-?\\b\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?\\b|\\b\\d+\\.\\d{1,2}\\b)");

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();
        String textContent = extractJsonString(body, "content");
        if (textContent.isEmpty()) {
            textContent = body;
        }

        if (textContent.trim().isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"PDF text content is empty.\"}");
            return;
        }

        List<Map<String, Object>> transactions = parsePdfStatementText(textContent);

        StringBuilder sb = new StringBuilder();
        sb.append("{\"success\":true,\"format\":\"PDF\",\"count\":").append(transactions.size()).append(",\"transactions\":[");
        for (int i = 0; i < transactions.size(); i++) {
            Map<String, Object> map = transactions.get(i);
            sb.append("{");
            sb.append("\"transaction_id\":\"").append(escapeJson((String) map.get("transaction_id"))).append("\",");
            sb.append("\"date\":\"").append(escapeJson((String) map.get("date"))).append("\",");
            sb.append("\"amount\":").append(map.get("amount")).append(",");
            sb.append("\"description\":\"").append(escapeJson((String) map.get("description"))).append("\",");
            sb.append("\"reference\":\"").append(escapeJson((String) map.get("reference"))).append("\"");
            sb.append("}");
            if (i < transactions.size() - 1) sb.append(",");
        }
        sb.append("]}");

        sendJsonResponse(resp, HttpServletResponse.SC_OK, sb.toString());
    }

    public List<Map<String, Object>> parsePdfStatementText(String text) throws IOException {
        List<Map<String, Object>> list = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new StringReader(text));
        String line;
        int lineCounter = 0;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty() || line.toLowerCase().startsWith("page ") || line.toLowerCase().startsWith("statement of account")) {
                continue;
            }

            // Look for Date pattern
            Matcher dateMatcher = DATE_PATTERN.matcher(line);
            if (dateMatcher.find()) {
                lineCounter++;
                String date = dateMatcher.group(1);
                String remaining = line.replace(date, " ").trim();

                // Find amounts in the remaining line
                List<Double> foundAmounts = new ArrayList<>();
                Matcher amtMatcher = AMOUNT_PATTERN.matcher(remaining);
                while (amtMatcher.find()) {
                    String match = amtMatcher.group(1).replace(",", "");
                    try {
                        double val = Double.parseDouble(match);
                        foundAmounts.add(val);
                    } catch (Exception ignored) {}
                }

                double amount = 0.0;
                if (!foundAmounts.isEmpty()) {
                    amount = foundAmounts.get(0);
                }

                // Reference & narration extraction
                String ref = "TXN-" + String.format("%03d", lineCounter);
                Pattern refPat = Pattern.compile("([A-Z0-9]{3,}-[A-Z0-9]{3,})");
                Matcher refMatch = refPat.matcher(remaining);
                if (refMatch.find()) {
                    ref = refMatch.group(1);
                }

                Map<String, Object> record = new LinkedHashMap<>();
                record.put("transaction_id", ref);
                record.put("date", date);
                record.put("amount", amount);
                record.put("description", remaining);
                record.put("reference", ref);

                list.add(record);
            }
        }
        return list;
    }
}
