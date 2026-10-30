package com.reconcilex.servlet;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * UploadServlet
 * Unified multi-format document parser handling CSV, TXT, and statement streams.
 * Parses headers dynamically and normalizes financial records.
 * Mapped to /api/upload and /UploadServlet
 */
public class UploadServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();
        String fileType = req.getParameter("type");
        if (fileType == null || fileType.isEmpty()) {
            fileType = extractJsonString(body, "type");
        }
        if (fileType.isEmpty()) fileType = "AUTO";

        String rawContent = extractJsonString(body, "content");
        if (rawContent.isEmpty()) {
            // Raw text or multipart fallback
            rawContent = body;
        }

        if (rawContent.trim().isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"File content is empty.\"}");
            return;
        }

        List<Map<String, String>> records = parseDelimitedContent(rawContent);

        StringBuilder json = new StringBuilder();
        json.append("{\"success\":true,");
        json.append("\"type\":\"").append(fileType).append("\",");
        json.append("\"recordCount\":").append(records.size()).append(",");
        json.append("\"records\":[");

        for (int i = 0; i < records.size(); i++) {
            Map<String, String> row = records.get(i);
            json.append("{");
            int j = 0;
            for (Map.Entry<String, String> entry : row.entrySet()) {
                json.append("\"").append(escapeJson(entry.getKey())).append("\":\"")
                    .append(escapeJson(entry.getValue())).append("\"");
                if (++j < row.size()) json.append(",");
            }
            json.append("}");
            if (i < records.size() - 1) json.append(",");
        }
        json.append("]}");

        sendJsonResponse(resp, HttpServletResponse.SC_OK, json.toString());
    }

    public List<Map<String, String>> parseDelimitedContent(String content) throws IOException {
        List<Map<String, String>> list = new ArrayList<>();
        if (content == null || content.trim().isEmpty()) return list;

        BufferedReader reader = new BufferedReader(new StringReader(content));
        String line;
        List<String> headers = null;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#") || line.startsWith("--")) continue;

            List<String> tokens = parseCsvLine(line);
            if (tokens.isEmpty()) continue;

            if (headers == null) {
                // Header row
                headers = new ArrayList<>();
                for (String token : tokens) {
                    headers.add(normalizeHeader(token));
                }
            } else {
                Map<String, String> record = new LinkedHashMap<>();
                for (int i = 0; i < headers.size() && i < tokens.size(); i++) {
                    record.put(headers.get(i), tokens.get(i));
                }
                if (!record.isEmpty()) {
                    list.add(record);
                }
            }
        }
        return list;
    }

    protected List<String> parseCsvLine(String line) {
        List<String> tokens = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '\"') {
                inQuotes = !inQuotes;
            } else if ((c == ',' || c == '\t' || c == ';') && !inQuotes) {
                tokens.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        tokens.add(sb.toString().trim());
        return tokens;
    }

    protected String normalizeHeader(String header) {
        if (header == null) return "";
        return header.trim().replaceAll("[\"']", "");
    }

    protected String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}
