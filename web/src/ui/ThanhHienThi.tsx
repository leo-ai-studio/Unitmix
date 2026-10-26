export type NutHienThi = { khoa: string; nhan: string; bat?: boolean; onClick?: () => void };

/** Thanh nút hiển thị ở đáy bản vẽ (Đo, Kích thước, Cơ cấu, Phóng…). */
export function ThanhHienThi({ nut, nhan }: { nut: NutHienThi[]; nhan: string }) {
  return (
    <div class="thanh-hien-thi">
      <div role="group" aria-label={nhan}>
        {nut.map((n) => (
          <button key={n.khoa} type="button" aria-pressed={n.bat === undefined ? undefined : n.bat} onClick={n.onClick}>
            {n.nhan}
          </button>
        ))}
      </div>
    </div>
  );
}
