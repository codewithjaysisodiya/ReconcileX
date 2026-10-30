package com.reconcilex.dao;

import com.reconcilex.config.DBConfig;
import com.reconcilex.model.ReconciledTransaction;

import java.sql.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data Access Object (DAO) for Reconciled Transaction records.
 * Provides JDBC batch persistence, status filtering, discrepancy queries,
 * and seamless in-memory fallback when MySQL is offline.
 */
public class TransactionDAO {

    private static final List<ReconciledTransaction> memoryTransactions = new CopyOnWriteArrayList<>();
    private static final AtomicInteger memoryTxnId = new AtomicInteger(1);

    /**
     * Batch insert reconciled transactions into the database
     */
    public static void saveTransactionsBatch(int sessionId, List<ReconciledTransaction> transactions) throws SQLException {
        if (transactions == null || transactions.isEmpty()) return;

        if (DBConfig.isDatabaseAvailable()) {
            String sql = "INSERT INTO reconciled_transactions (" +
                "session_id, transaction_id, occurrence_index, bank_amount, company_amount, " +
                "difference, bank_date, company_date, date_difference_days, status, " +
                "bank_description, company_description, bank_reference, company_reference, audit_notes" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
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
            } catch (SQLException e) {
                System.err.println("TransactionDAO batch insert failed: " + e.getMessage());
                throw e;
            }
            return;
        }

        // In-Memory Fallback
        for (ReconciledTransaction t : transactions) {
            t.setId(memoryTxnId.getAndIncrement());
            t.setSessionId(sessionId);
            memoryTransactions.add(t);
        }
    }

    /**
     * Retrieve all reconciled transactions for a given session
     */
    public static List<ReconciledTransaction> getTransactionsBySession(int sessionId) {
        if (DBConfig.isDatabaseAvailable()) {
            String sql = "SELECT * FROM reconciled_transactions WHERE session_id = ? ORDER BY id ASC";
            List<ReconciledTransaction> list = new ArrayList<>();
            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, sessionId);
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        list.add(mapResultSetToTransaction(rs));
                    }
                }
                return list;
            } catch (SQLException e) {
                System.err.println("TransactionDAO fetch error: " + e.getMessage());
            }
        }

        // Fallback: Filter Memory Store
        List<ReconciledTransaction> filtered = new ArrayList<>();
        for (ReconciledTransaction t : memoryTransactions) {
            if (t.getSessionId() == sessionId) filtered.add(t);
        }
        return filtered;
    }

    /**
     * Filter transactions by reconciliation status (matched, unmatched_bank, unmatched_company, etc.)
     */
    public static List<ReconciledTransaction> getTransactionsByStatus(int sessionId, String status) {
        List<ReconciledTransaction> all = getTransactionsBySession(sessionId);
        if (status == null || status.equalsIgnoreCase("all")) return all;

        List<ReconciledTransaction> filtered = new ArrayList<>();
        for (ReconciledTransaction t : all) {
            if (status.equalsIgnoreCase(t.getStatus())) {
                filtered.add(t);
            }
        }
        return filtered;
    }

    /**
     * Retrieve all discrepancy transactions (unmatched, amount mismatches, date mismatches)
     */
    public static List<ReconciledTransaction> getDiscrepancies(int sessionId) {
        List<ReconciledTransaction> all = getTransactionsBySession(sessionId);
        List<ReconciledTransaction> discrepancies = new ArrayList<>();
        for (ReconciledTransaction t : all) {
            if (!"matched".equalsIgnoreCase(t.getStatus())) {
                discrepancies.add(t);
            }
        }
        return discrepancies;
    }

    /**
     * Update transaction audit notes or resolution status by database ID
     */
    public static boolean updateAuditNotes(int transactionId, String notes, String status) {
        if (DBConfig.isDatabaseAvailable()) {
            String sql = "UPDATE reconciled_transactions SET audit_notes = ?, status = COALESCE(NULLIF(?, ''), status) WHERE id = ?";
            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, notes);
                stmt.setString(2, status != null ? status : "");
                stmt.setInt(3, transactionId);
                return stmt.executeUpdate() > 0;
            } catch (SQLException e) {
                System.err.println("TransactionDAO update error: " + e.getMessage());
            }
        }

        // Memory fallback
        for (ReconciledTransaction t : memoryTransactions) {
            if (t.getId() == transactionId) {
                t.setAuditNotes(notes);
                if (status != null && !status.isEmpty()) t.setStatus(status);
                return true;
            }
        }
        return false;
    }

    public static boolean updateAuditNotes(int transactionId, String notes) {
        return updateAuditNotes(transactionId, notes, null);
    }

    /**
     * Update transaction audit notes by business transactionId (e.g. "TXN-001" or "GRE-B001")
     */
    public static boolean updateAuditNotes(String transactionCode, String notes, String status) {
        if (transactionCode == null || transactionCode.trim().isEmpty()) return false;

        // Try numeric ID first
        try {
            int numId = Integer.parseInt(transactionCode.trim());
            if (updateAuditNotes(numId, notes, status)) return true;
        } catch (NumberFormatException ignored) {}

        if (DBConfig.isDatabaseAvailable()) {
            String sql = "UPDATE reconciled_transactions SET audit_notes = ?, status = COALESCE(NULLIF(?, ''), status) WHERE transaction_id = ?";
            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, notes);
                stmt.setString(2, status != null ? status : "");
                stmt.setString(3, transactionCode.trim());
                return stmt.executeUpdate() > 0;
            } catch (SQLException e) {
                System.err.println("TransactionDAO update error: " + e.getMessage());
            }
        }

        // Memory fallback
        for (ReconciledTransaction t : memoryTransactions) {
            if (transactionCode.equalsIgnoreCase(t.getTransactionId())) {
                t.setAuditNotes(notes);
                if (status != null && !status.isEmpty()) t.setStatus(status);
                return true;
            }
        }
        return false;
    }

    public static boolean updateAuditNotes(String transactionCode, String notes) {
        return updateAuditNotes(transactionCode, notes, null);
    }

    private static ReconciledTransaction mapResultSetToTransaction(ResultSet rs) throws SQLException {
        ReconciledTransaction t = new ReconciledTransaction();
        t.setId(rs.getInt("id"));
        t.setSessionId(rs.getInt("session_id"));
        t.setTransactionId(rs.getString("transaction_id"));
        t.setOccurrenceIndex(rs.getInt("occurrence_index"));

        double bankAmt = rs.getDouble("bank_amount");
        t.setBankAmount(rs.wasNull() ? null : bankAmt);

        double compAmt = rs.getDouble("company_amount");
        t.setCompanyAmount(rs.wasNull() ? null : compAmt);

        t.setDifference(rs.getDouble("difference"));
        t.setBankDate(rs.getDate("bank_date"));
        t.setCompanyDate(rs.getDate("company_date"));

        int dateDiff = rs.getInt("date_difference_days");
        t.setDateDifferenceDays(rs.wasNull() ? null : dateDiff);

        t.setStatus(rs.getString("status"));
        t.setBankDescription(rs.getString("bank_description"));
        t.setCompanyDescription(rs.getString("company_description"));
        t.setBankReference(rs.getString("bank_reference"));
        t.setCompanyReference(rs.getString("company_reference"));
        t.setAuditNotes(rs.getString("audit_notes"));
        return t;
    }
}
