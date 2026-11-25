package edu.lab.select.web;

import edu.lab.select.model.Resume;
import edu.lab.select.service.ApiException;
import edu.lab.select.service.SelectionService;
import edu.lab.select.service.TokenStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/student")
public class StudentController extends BaseController {

    private final SelectionService service;

    public StudentController(TokenStore tokens, SelectionService service) {
        super(tokens);
        this.service = service;
    }

    @GetMapping("/home")
    public Map<String, Object> home(@RequestHeader(value = "X-Token", required = false) String token) {
        return service.studentHome(self(token, "student"));
    }

    @GetMapping("/intentions")
    public Map<String, Object> intentions(@RequestHeader(value = "X-Token", required = false) String token) {
        return service.myIntentions(self(token, "student"));
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/intentions")
    public Map<String, Object> submit(@RequestHeader(value = "X-Token", required = false) String token,
                                      @RequestBody Map<String, Object> body) {
        Long sid = self(token, "student");
        List<Long> ids = new ArrayList<>();
        Object raw = body.get("mentorIds");
        if (raw instanceof List<?> list) {
            for (Object o : list) ids.add(Long.valueOf(String.valueOf(o)));
        }
        boolean inner = Boolean.TRUE.equals(body.get("acceptInner"));
        boolean cross = Boolean.TRUE.equals(body.get("acceptCross"));
        return service.submitIntentions(sid, ids, inner, cross);
    }

    @GetMapping("/offers")
    public Map<String, Object> offers(@RequestHeader(value = "X-Token", required = false) String token) {
        return service.myOffers(self(token, "student"));
    }

    @PostMapping("/offers/{id}/confirm")
    public Map<String, Object> confirm(@RequestHeader(value = "X-Token", required = false) String token,
                                       @PathVariable Long id) {
        return service.confirmOffer(self(token, "student"), id);
    }

    // ---------------------------------------------------------------- 简历

    @GetMapping("/resume")
    public Map<String, Object> resume(@RequestHeader(value = "X-Token", required = false) String token) {
        Map<String, Object> meta = service.resumeMeta(self(token, "student"));
        Map<String, Object> out = new HashMap<>();
        out.put("resume", meta);
        return out;
    }

    @PostMapping("/resume")
    public Map<String, Object> upload(@RequestHeader(value = "X-Token", required = false) String token,
                                      @RequestParam("file") MultipartFile file) throws IOException {
        return service.saveResume(self(token, "student"),
                file.getOriginalFilename(), file.getContentType(), file.getBytes());
    }

    @DeleteMapping("/resume")
    public Map<String, Object> removeResume(@RequestHeader(value = "X-Token", required = false) String token) {
        return service.deleteResume(self(token, "student"));
    }

    @GetMapping("/resume/file")
    public ResponseEntity<byte[]> download(@RequestHeader(value = "X-Token", required = false) String token) {
        Resume r = service.resumeFile(self(token, "student"));
        if (r == null) throw new ApiException("还没有上传简历");
        return attachment(r);
    }
}
