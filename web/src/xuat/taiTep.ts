/** Tải một tệp về máy từ chuỗi / Blob (liên kết tạm, gỡ sau 2 giây). */
export function taiVeTep(noiDung: string | Blob, tenTep: string, loai: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(noiDung instanceof Blob ? noiDung : new Blob([noiDung], { type: loai }));
  a.download = tenTep;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
