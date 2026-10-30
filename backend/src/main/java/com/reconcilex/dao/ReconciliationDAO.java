package com.reconcilex.dao;

import com.reconcilex.config.DBConfig;
import com.reconcilex.model.ReconciliationSession;
import com.reconcilex.model.ReconciledTransaction;

import java.sql.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

public class ReconciliationDAO {

    private static final List<ReconciliationSession> memorySessions = new CopyOnWriteArrayList<>();
    private static final AtomicInteger memorySessionId = new AtomicInteger(1);

    public static int saveSession(ReconciliationSession session) throws SQLException {
        if (DBConfig.isDatabaseAvailable()) {
            String sql = "INSERT INTO reconciliation_sessions (" +
                "session_code, user_id, bank_file_name, company_file_name, " +
                "bank_records_count, company_records_count, total_processed, " +
                "matched_count, unmatched_count, mismatch_count, duplicate_count, " +
                "match_percentage, total_discrepancy, net_variance, amount_tolerance, " +
                "date_tolerance_days, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, session.getSessionCode());
                if (session.getUserId() != null) stmt.setInt(2, session.getUserId());
                else stmt.setNull(2, Types.INTEGER);
                stmt.setString(3, session.getBankFileName());
                stmt.setString(4, session.getCompanyFileName());
                stmt.setInt(5, session.getBankRecordsCount());
                stmt.setInt(6, session.getCompanyRecordsCount());
                stmt.setInt(7, session.getTotalProcessed());
                stmt.setInt(8, session.getMatchedCount());
                stmt.setInt(9, session.getUnmatchedCount());
                stmt.setInt(10, session.getMismatchCount());
                stmt.setInt(11, session.getDuplicateCount());
                stmt.setDouble(12, session.getMatchPercentage());
                stmt.setDouble(13, session.getTotalDiscrepancy());
                stmt.setDouble(14, session.getNetVariance());
                stmt.setDouble(15, session.getAmountTolerance());
                stmt.setInt(16, session.getDateToleranceDays());
                stmt.setString(17, session.getCurrency() != null ? session.getCurrency() : "INR");

                stmt.executeUpdate();
                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        int id = rs.getInt(1);
                        session.setId(id);
                        return id;
                    }
                }
            }
        }

        // Fallback: Memory Storage
        int newId = memorySessionId.getAndIncrement();
        session.setId(newId);
        session.setCreatedAt(new Timestamp(System.currentTimeMillis()));
        memorySessions.add(0, session);
        return newId;
    }

    public static void saveTransactions(int sessionId, List<ReconciledTransaction> transactions) throws SQLException {
        if (!DBConfig.isDatabaseAvailable()) return;

        String sql = "INSERT INTO reconciled_transactions (" +
            "session_id, transaction_id, occurrence_index, bank_amount, company_amount, " +
            "difference, bank_date, company_date, date_difference_days, status, " +
            "bank_description, company_description, bank_reference, company_reference, audit_notes" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        try (Connection conn = DBConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);
            for (ReconciledTransaction t : transactions) {
                stmt.setInt(1, sessionId);
                stmt.setString(2, t.getTransactionId());
                stmt.setInt(3, t.getOccurrenceIndex());
                if (t.getBankAmount() != null) stmt.setDouble(4, t.getBankAmount());
                else stmt.setNull(4, Types.DOUBLE);
                if (t.getCompanyAmount() != null) stmt.setDouble(5, t.getCompanyAmount());
                else stmt.setNull(5, Types.DOUBLE);
                stmt.setDouble(6, t.getDifference());
                stmt.setDate(7, t.getBankDate());
                stmt.setDate(8, t.getCompanyDate());
                if (t.getDateDifferenceDays() != null) stmt.setInt(9, t.getDateDifferenceDays());
                else stmt.setNull(9, Types.INTEGER);
                stmt.setString(10, t.getStatus());
                stmt.setString(11, t.getBankDescription());
                stmt.setString(12, t.getCompanyDescription());
                stmt.setString(13, t.getBankReference());
                stmt.setString(14, t.getCompanyReference());
                stmt.setString(15, t.getAuditNotes());
                stmt.addBatch();
            }
            stmt.executeBatch();
            conn.commit();
        }
    }

    public static List<ReconciliationSession> getRecentSessions(int limit) throws SQLException {
        if (DBConfig.isDatabaseAvailable()) {
            String sql = "SELECT * FROM reconciliation_sessions ORDER BY created_at DESC LIMIT ?";
            List<ReconciliationSession> list = new ArrayList<>();
            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, limit);
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        ReconciliationSession s = new ReconciliationSession();
                        s.setId(rs.getInt("id"));
                        s.setSessionCode(rs.getString("session_code"));
                        s.setBankFileName(rs.getString("bank_file_name"));
                        s.setCompanyFileName(rs.getString("company_file_name"));
                        s.setTotalProcessed(rs.getInt("total_processed"));
                        s.setMatchedCount(rs.getInt("matched_count"));
                        s.setUnmatchedCount(rs.getInt("unmatched_count"));
                        s.setMismatchCount(rs.getInt("mismatch_count"));
                        s.setDuplicateCount(rs.getInt("duplicate_count"));
                        s.setMatchPercentage(rs.getDouble("match_percentage"));
                        s.setTotalDiscrepancy(rs.getDouble("total_discrepancy"));
                        s.setNetVariance(rs.getDouble("net_variance"));
                        s.setCreatedAt(rs.getTimestamp("created_at"));
                        list.add(s);
                    }
                }
            }
            return list;
        }

        // Fallback: Memory
        int end = Math.min(limit, memorySessions.size());
        return new ArrayList<>(memorySessions.subList(0, end));
    }
}
