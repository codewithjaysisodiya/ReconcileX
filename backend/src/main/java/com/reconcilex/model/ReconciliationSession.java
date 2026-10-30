package com.reconcilex.model;

import java.sql.Timestamp;

public class ReconciliationSession {
    private int id;
    private String sessionCode;
    private Integer userId;
    private String bankFileName;
    private String companyFileName;
    private int bankRecordsCount;
    private int companyRecordsCount;
    private int totalProcessed;
    private int matchedCount;
    private int unmatchedCount;
    private int mismatchCount;
    private int duplicateCount;
    private double matchPercentage;
    private double totalDiscrepancy;
    private double netVariance;
    private double amountTolerance;
    private int dateToleranceDays;
    private String currency;
    private Timestamp createdAt;

    public ReconciliationSession() {}

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getSessionCode() { return sessionCode; }
    public void setSessionCode(String sessionCode) { this.sessionCode = sessionCode; }

    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }

    public String getBankFileName() { return bankFileName; }
    public void setBankFileName(String bankFileName) { this.bankFileName = bankFileName; }

    public String getCompanyFileName() { return companyFileName; }
    public void setCompanyFileName(String companyFileName) { this.companyFileName = companyFileName; }

    public int getBankRecordsCount() { return bankRecordsCount; }
    public void setBankRecordsCount(int bankRecordsCount) { this.bankRecordsCount = bankRecordsCount; }

    public int getCompanyRecordsCount() { return companyRecordsCount; }
    public void setCompanyRecordsCount(int companyRecordsCount) { this.companyRecordsCount = companyRecordsCount; }

    public int getTotalProcessed() { return totalProcessed; }
    public void setTotalProcessed(int totalProcessed) { this.totalProcessed = totalProcessed; }

    public int getMatchedCount() { return matchedCount; }
    public void setMatchedCount(int matchedCount) { this.matchedCount = matchedCount; }

    public int getUnmatchedCount() { return unmatchedCount; }
    public void setUnmatchedCount(int unmatchedCount) { this.unmatchedCount = unmatchedCount; }

    public int getMismatchCount() { return mismatchCount; }
    public void setMismatchCount(int mismatchCount) { this.mismatchCount = mismatchCount; }

    public int getDuplicateCount() { return duplicateCount; }
    public void setDuplicateCount(int duplicateCount) { this.duplicateCount = duplicateCount; }

    public double getMatchPercentage() { return matchPercentage; }
    public void setMatchPercentage(double matchPercentage) { this.matchPercentage = matchPercentage; }

    public double getTotalDiscrepancy() { return totalDiscrepancy; }
    public void setTotalDiscrepancy(double totalDiscrepancy) { this.totalDiscrepancy = totalDiscrepancy; }

    public double getNetVariance() { return netVariance; }
    public void setNetVariance(double netVariance) { this.netVariance = netVariance; }

    public double getAmountTolerance() { return amountTolerance; }
    public void setAmountTolerance(double amountTolerance) { this.amountTolerance = amountTolerance; }

    public int getDateToleranceDays() { return dateToleranceDays; }
    public void setDateToleranceDays(int dateToleranceDays) { this.dateToleranceDays = dateToleranceDays; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public String toJson() {
        return "{" +
            "\"id\":" + id + "," +
            "\"sessionCode\":\"" + escape(sessionCode) + "\"," +
            "\"bankFileName\":\"" + escape(bankFileName) + "\"," +
            "\"companyFileName\":\"" + escape(companyFileName) + "\"," +
            "\"totalProcessed\":" + totalProcessed + "," +
            "\"matchedCount\":" + matchedCount + "," +
            "\"unmatchedCount\":" + unmatchedCount + "," +
            "\"mismatchCount\":" + mismatchCount + "," +
            "\"duplicateCount\":" + duplicateCount + "," +
            "\"matchPercentage\":" + matchPercentage + "," +
            "\"totalDiscrepancy\":" + totalDiscrepancy + "," +
            "\"netVariance\":" + netVariance + "," +
            "\"createdAt\":\"" + (createdAt != null ? createdAt.toString() : "") + "\"" +
        "}";
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}
