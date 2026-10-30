package com.reconcilex.servlet;

import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Standard HttpServletRequest abstraction providing parameter parsing,
 * header inspection, body reading, and stream access.
 */
public class HttpServletRequest {

    private final String method;
    private final String requestUri;
    private final Map<String, List<String>> headers;
    private final Map<String, String[]> parameters = new HashMap<>();
    private final byte[] bodyBytes;

    public HttpServletRequest(String method, String requestUri, Map<String, List<String>> headers, InputStream bodyStream) throws IOException {
        this.method = method != null ? method.toUpperCase() : "GET";
        this.requestUri = requestUri != null ? requestUri : "/";
        this.headers = headers != null ? headers : new HashMap<>();

        // Read body into memory
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        if (bodyStream != null) {
            byte[] buf = new byte[2048];
            int n;
            while ((n = bodyStream.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
        }
        this.bodyBytes = baos.toByteArray();

        // Parse query string parameters
        if (this.requestUri.contains("?")) {
            String queryString = this.requestUri.substring(this.requestUri.indexOf("?") + 1);
            parseQueryString(queryString);
        }

        // If form urlencoded in POST/PUT, parse body into parameters
        String ctype = getContentType();
        if (ctype != null && ctype.contains("application/x-www-form-urlencoded") && bodyBytes.length > 0) {
            String formStr = new String(bodyBytes, StandardCharsets.UTF_8);
            parseQueryString(formStr);
        }
    }

    private void parseQueryString(String query) {
        if (query == null || query.isEmpty()) return;
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            try {
                String key = idx > 0 ? URLDecoder.decode(pair.substring(0, idx), "UTF-8") : pair;
                String val = (idx > 0 && pair.length() > idx + 1) ? URLDecoder.decode(pair.substring(idx + 1), "UTF-8") : "";
                if (!parameters.containsKey(key)) {
                    parameters.put(key, new String[]{val});
                } else {
                    String[] oldArr = parameters.get(key);
                    String[] newArr = Arrays.copyOf(oldArr, oldArr.length + 1);
                    newArr[newArr.length - 1] = val;
                    parameters.put(key, newArr);
                }
            } catch (UnsupportedEncodingException ignored) {}
        }
    }

    public String getMethod() {
        return method;
    }

    public String getRequestURI() {
        return requestUri;
    }

    public String getPathInfo() {
        int qIdx = requestUri.indexOf("?");
        return qIdx != -1 ? requestUri.substring(0, qIdx) : requestUri;
    }

    public String getHeader(String name) {
        if (headers == null || name == null) return null;
        for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
            if (name.equalsIgnoreCase(entry.getKey())) {
                List<String> vals = entry.getValue();
                return (vals != null && !vals.isEmpty()) ? vals.get(0) : null;
            }
        }
        return null;
    }

    public String getContentType() {
        return getHeader("Content-Type");
    }

    public int getContentLength() {
        return bodyBytes != null ? bodyBytes.length : 0;
    }

    public String getParameter(String name) {
        String[] vals = parameters.get(name);
        return (vals != null && vals.length > 0) ? vals[0] : null;
    }

    public Map<String, String[]> getParameterMap() {
        return Collections.unmodifiableMap(parameters);
    }

    public InputStream getInputStream() {
        return new ByteArrayInputStream(bodyBytes);
    }

    public BufferedReader getReader() {
        return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
    }

    public String getBody() {
        return new String(bodyBytes, StandardCharsets.UTF_8);
    }

    public byte[] getBodyBytes() {
        return bodyBytes;
    }
}
