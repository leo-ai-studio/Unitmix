import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

type Props = { tieuDe: string; giaiThich?: string; mo?: boolean; children?: ComponentChildren };

/** Mục gập/mở trong panel; giaiThich hiện thành bong bóng khi rê chuột tiêu đề. */
export function MucGap({ tieuDe, giaiThich, mo = false, children }: Props) {
  const [dangMo, setMo] = useState(mo);
  return (
    <section>
      <button class="muc-dau" type="button" aria-expanded={dangMo} title={giaiThich} onClick={() => setMo(!dangMo)}>
        <span aria-hidden="true">{dangMo ? '▾' : '▸'}</span>
        {tieuDe}
      </button>
      {dangMo && <div class="muc-than">{children}</div>}
    </section>
  );
}
