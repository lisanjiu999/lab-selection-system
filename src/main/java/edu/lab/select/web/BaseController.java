package edu.lab.select.web;

import edu.lab.select.model.Resume;
import edu.lab.select.service.ApiException;
import edu.lab.select.service.TokenStore;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

public abstract class BaseController {

    protected final TokenStore tokens;

    protected BaseController(TokenStore tokens) {
        this.tokens = tokens;
    }

    protected TokenStore.Session session(String token) {
        TokenStore.Session s = tokens.get(token);
        if (s == null) throw new ApiException("登录已失效，请重新登录");
        return s;
    }

    protected Long self(String token, String role) {
        TokenStore.Session s = session(token);
        if (!role.equals(s.role())) throw new ApiException("当前身份无权访问该功能");
        return s.id();
    }

    /**
     * 简历下载响应。文件名带中文，必须走 RFC 5987 的 filename*，
     * 只写 filename= 的话浏览器会按 ISO-8859-1 解，中文直接变乱码。
     */
    protected ResponseEntity<byte[]> attachment(Resume r) {
        String type = (r.contentType == null || r.contentType.isBlank())
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : r.contentType;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, type)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(r.fileName, StandardCharsets.UTF_8)
                        .build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(r.data);
    }
}
