package edu.lab.select.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 学生简历。一个学生只保留一份，重新上传即覆盖。
 * 文件内容直接存库：H2 是内存库，重启即重置，文件放磁盘反而会留下对不上号的孤儿文件。
 */
@Entity
@Table(name = "resume", uniqueConstraints = @UniqueConstraint(columnNames = {"studentId"}))
public class Resume {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long studentId;
    public String fileName;
    public String contentType;
    public long size;
    public LocalDateTime uploadedAt;

    @Lob
    public byte[] data;
}
