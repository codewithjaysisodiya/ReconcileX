package com.reconcilex.util;

import com.reconcilex.servlet.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Direct In-Memory Verification Test for All ReconcileX Servlets
 */
public class ServletTest {

    public static void main(String[] args) {
        System.out.println("========== Running ReconcileX Servlet Suite Test ==========");
        int passed = 0;
        int failed = 0;

        // 1. RegisterServlet Test
        try {
            RegisterServlet regServlet = new RegisterServlet();
            String regJson = "{\"username\":\"analyst_test\",\"email\":\"test@reconcilex.com\",\"password\":\"Pass123\",\"fullName\":\"Test Analyst\",\"role\":\"ANALYST\"}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/auth/register", new HashMap<>(), new ByteArrayInputStream(regJson.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            regServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 201 && output.contains("success\":true")) {
                System.out.println("[PASS] 1. RegisterServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 1. RegisterServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 1. RegisterServlet -> " + e.getMessage());
            failed++;
        }

        // 2. LoginServlet Test
        try {
            LoginServlet loginServlet = new LoginServlet();
            String loginJson = "{\"username\":\"analyst_test\",\"password\":\"Pass123\"}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/auth/login", new HashMap<>(), new ByteArrayInputStream(loginJson.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            loginServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("success\":true")) {
                System.out.println("[PASS] 2. LoginServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 2. LoginServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 2. LoginServlet -> " + e.getMessage());
            failed++;
        }

        // 3. CSVUploadServlet Test
        try {
            CSVUploadServlet csvServlet = new CSVUploadServlet();
            String csvData = "Date,Reference,Amount,Narration\n2026-09-01,REF-001,50000.0,Opening\n2026-09-02,REF-002,-15000.0,Vendor Pmt";
            String reqBody = "{\"content\":\"" + csvData.replace("\n", "\\n") + "\"}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/upload/csv", new HashMap<>(), new ByteArrayInputStream(reqBody.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            csvServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("\"count\":2")) {
                System.out.println("[PASS] 3. CSVUploadServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 3. CSVUploadServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 3. CSVUploadServlet -> " + e.getMessage());
            failed++;
        }

        // 4. PDFUploadServlet Test
        try {
            PDFUploadServlet pdfServlet = new PDFUploadServlet();
            String pdfText = "2026-09-01 GRE-B000 Opening balance 510000.0\n2026-09-02 GRE-B001 IMPS PackRight 18500.0";
            String reqBody = "{\"content\":\"" + pdfText.replace("\n", "\\n") + "\"}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/upload/pdf", new HashMap<>(), new ByteArrayInputStream(reqBody.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            pdfServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("\"count\":2")) {
                System.out.println("[PASS] 4. PDFUploadServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 4. PDFUploadServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 4. PDFUploadServlet -> " + e.getMessage());
            failed++;
        }

        // 5. ReconciliationServlet Test
        int createdSessionId = 1;
        try {
            ReconciliationServlet recServlet = new ReconciliationServlet();
            String recJson = "{\"sessionCode\":\"TEST-SESS-101\",\"totalProcessed\":25,\"matchedCount\":20,\"unmatchedCount\":3,\"mismatchCount\":2,\"duplicateCount\":1,\"matchPercentage\":80.0,\"totalDiscrepancy\":1250.0,\"netVariance\":500.0," +
                "\"transactions\":[{\"transaction_id\":\"GRE-001\",\"bank_amount\":1000.0,\"company_amount\":1000.0,\"difference\":0.0,\"status\":\"matched\"}," +
                "{\"transaction_id\":\"GRE-002\",\"bank_amount\":500.0,\"company_amount\":450.0,\"difference\":50.0,\"status\":\"mismatch\"}]}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/reconciliation", new HashMap<>(), new ByteArrayInputStream(recJson.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            recServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 201 && output.contains("success\":true")) {
                System.out.println("[PASS] 5. ReconciliationServlet (POST)");
                passed++;
            } else {
                System.out.println("[FAIL] 5. ReconciliationServlet (POST) -> " + output);
                failed++;
            }

            // GET test
            HttpServletRequest getReq = new HttpServletRequest("GET", "/api/reconciliation?sessionId=" + createdSessionId, new HashMap<>(), null);
            HttpServletResponse getResp = new HttpServletResponse();
            recServlet.service(getReq, getResp);
            String getOutput = new String(getResp.toByteArray(), StandardCharsets.UTF_8);
            if (getResp.getStatus() == 200 && getOutput.contains("transactions")) {
                System.out.println("[PASS] 6. ReconciliationServlet (GET)");
                passed++;
            } else {
                System.out.println("[FAIL] 6. ReconciliationServlet (GET) -> " + getOutput);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 5/6. ReconciliationServlet -> " + e.getMessage());
            failed++;
        }

        // 7. DuplicateDetectionServlet Test
        try {
            DuplicateDetectionServlet dupServlet = new DuplicateDetectionServlet();
            String dupJson = "{\"transactions\":[" +
                "{\"transaction_id\":\"TXN-DUP\",\"date\":\"2026-09-19\",\"amount\":30500.0}," +
                "{\"transaction_id\":\"TXN-DUP\",\"date\":\"2026-09-19\",\"amount\":30500.0}]}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/duplicates", new HashMap<>(), new ByteArrayInputStream(dupJson.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            dupServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("\"duplicateCount\":1")) {
                System.out.println("[PASS] 7. DuplicateDetectionServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 7. DuplicateDetectionServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 7. DuplicateDetectionServlet -> " + e.getMessage());
            failed++;
        }

        // 8. ReportServlet Test
        try {
            ReportServlet repServlet = new ReportServlet();
            HttpServletRequest req = new HttpServletRequest("GET", "/api/report?sessionId=" + createdSessionId, new HashMap<>(), null);
            HttpServletResponse resp = new HttpServletResponse();
            repServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("Transaction ID,Status")) {
                System.out.println("[PASS] 8. ReportServlet (CSV Export)");
                passed++;
            } else {
                System.out.println("[FAIL] 8. ReportServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 8. ReportServlet -> " + e.getMessage());
            failed++;
        }

        // 9. AnalyticsServlet Test
        try {
            AnalyticsServlet anaServlet = new AnalyticsServlet();
            HttpServletRequest req = new HttpServletRequest("GET", "/api/analytics", new HashMap<>(), null);
            HttpServletResponse resp = new HttpServletResponse();
            anaServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("\"success\":true")) {
                System.out.println("[PASS] 9. AnalyticsServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 9. AnalyticsServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 9. AnalyticsServlet -> " + e.getMessage());
            failed++;
        }

        // 10. AuditServlet Test
        try {
            AuditServlet auditServlet = new AuditServlet();
            String auditJson = "{\"transactionId\":\"GRE-002\",\"auditNotes\":\"Approved by Senior Auditor after variance check.\"}";
            HttpServletRequest req = new HttpServletRequest("POST", "/api/audit", new HashMap<>(), new ByteArrayInputStream(auditJson.getBytes(StandardCharsets.UTF_8)));
            HttpServletResponse resp = new HttpServletResponse();
            auditServlet.service(req, resp);
            String output = new String(resp.toByteArray(), StandardCharsets.UTF_8);
            if (resp.getStatus() == 200 && output.contains("AUDIT_NOTES_UPDATED")) {
                System.out.println("[PASS] 10. AuditServlet");
                passed++;
            } else {
                System.out.println("[FAIL] 10. AuditServlet -> " + output);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("[FAIL] 10. AuditServlet -> " + e.getMessage());
            failed++;
        }

        System.out.println("==================================================");
        System.out.println("Results: " + passed + " PASSED, " + failed + " FAILED");
        System.out.println("==================================================");
        if (failed > 0) System.exit(1);
    }
}
