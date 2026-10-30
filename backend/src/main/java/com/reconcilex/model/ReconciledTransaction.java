package com.reconcilex.model;

import java.sql.Date;

public class ReconciledTransaction {
    private int id;
    private int sessionId;
    private String transactionId;
    private int occurrenceIndex;
    private Double bankAmount;
    private Double companyAmount;
    private double difference;
    private Date bankDate;
    private Date companyDate;
    private Integer dateDifferenceDays;
    private String status;
    private String bankDescription;
    private String companyDescription;
    private String bankReference;
    private String companyReference;
    private String auditNotes;

    public ReconciledTransaction() {}

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getSessionId() { return sessionId; }
    public void setSessionId(int sessionId) { this.sessionId = sessionId; }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

    public int getOccurrenceIndex() { return occurrenceIndex; }
    public void setOccurrenceIndex(int occurrenceIndex) { this.occurrenceIndex = occurrenceIndex; }

    public Double getBankAmount() { return bankAmount; }
    public void setBankAmount(Double bankAmount) { this.bankAmount = bankAmount; }

    public Double getCompanyAmount() { return companyAmount; }
    public void setCompanyAmount(Double companyAmount) { this.companyAmount = companyAmount; }

    public double getDifference() { return difference; }
    public void setDifference(double difference) { this.difference = difference; }

    public Date getBankDate() { return bankDate; }
    public void setBankDate(Date bankDate) { this.bankDate = bankDate; }

    public Date getCompanyDate() { return companyDate; }
    public void setCompanyDate(Date companyDate) { this.companyDate = companyDate; }

    public Integer getDateDifferenceDays() { return dateDifferenceDays; }
    public void setDateDifferenceDays(Integer dateDifferenceDays) { this.dateDifferenceDays = dateDifferenceDays; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getBankDescription() { return bankDescription; }
    public void setBankDescription(String bankDescription) { this.bankDescription = bankDescription; }

    public String getCompanyDescription() { return companyDescription; }
    public void setCompanyDescription(String companyDescription) { this.companyDescription = companyDescription; }

    public String getBankReference() { return bankReference; }
    public void setBankReference(String bankReference) { this.bankReference = bankReference; }

    public String getCompanyReference() { return companyReference; }
    public void setCompanyReference(String companyReference) { this.companyReference = companyReference; }

    public String getAuditNotes() { return auditNotes; }
    public void setAuditNotes(String auditNotes) { this.auditNotes = auditNotes; }
}
