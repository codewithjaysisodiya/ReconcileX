package com.reconcilex.servlet;

/**
 * Standard ServletException for ReconcileX Java Servlet architecture.
 */
public class ServletException extends Exception {
    public ServletException(String message) {
        super(message);
    }

    public ServletException(String message, Throwable cause) {
        super(message, cause);
    }

    public ServletException(Throwable cause) {
        super(cause);
    }
}
