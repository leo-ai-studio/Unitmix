import { h, type ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';

/** Chỗ của màn đang tải chunk: vòng O (kit LEO). `giua` phủ kín khung giữa (không đổi kích thước khung), `hop` nổi giữa màn hình. */
export type KieuCho = 'giua' | 'panel' | 'hop';

export function ChoTai({ kieu = 'panel' }: { kieu?: KieuCho }) {
  return (
    <div class={`cho-tai cho-tai-${kieu}`} role="status" aria-label={t('soan.dangTai')}>
      <img class="spin-o" src="/brand/leo_ai_o.png" alt="" />
    </div>
  );
}

/**
 * Màn nặng ít dùng tải lười (`import()` động — tách chunk khỏi chunk khởi động, de_xuat_hieu_nang P5):
 * lần đầu hiện vòng O tới khi chunk về, các lần sau vẽ ngay. Nhiều thành phần cùng một module dùng chung một lần tải.
 */
export function luoi<P extends object>(nap: () => Promise<ComponentType<P>>, kieu: KieuCho = 'panel'): ComponentType<P> {
  let C: ComponentType<P> | null = null;
  let dang: Promise<void> | null = null;
  const tai = () => (dang ??= nap().then((x) => { C = x; }, (e) => { dang = null; throw e; }));
  return function Luoi(props: P) {
    const [, ve] = useState(0);
    useEffect(() => {
      let huy = false;
      if (!C) tai().then(() => !huy && ve((n) => n + 1), () => {});
      return () => { huy = true; };
    }, []);
    return C ? h(C, props) : <ChoTai kieu={kieu} />;
  };
}
