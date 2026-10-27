import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

type Props = { tieuDe: string; giaiThich?: string; mo?: boolean; children?: ComponentChildren };

/** Mục gập/mở trong panel; giaiThich hiện thành bong bóng khi rê chuột tiêu đề. Thân luôn render, trượt mở / gập bằng CSS (grid 0fr ↔ 1fr). */
export function MucGap({ tieuDe, giaiThich, mo = false, children }: Props) {
  const [dangMo, setMo] = useState(mo);
  return (
    <section>
      <button class="muc-dau" type="button" aria-expanded={dangMo} title={giaiThich} onClick={() => setMo(!dangMo)}>
        <span class="mui-ten" aria-hidden="true">▸</span>
        {tieuDe}
      </button>
      <div class="muc-than-boc" data-mo={dangMo ? '1' : '0'} aria-hidden={!dangMo}>
        <div class="muc-than-trong" inert={!dangMo}>
          <div class="muc-than">{children}</div>
        </div>
      </div>
    </section>
  );
}
