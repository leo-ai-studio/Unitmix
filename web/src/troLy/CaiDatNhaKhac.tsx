/** Cài đặt Leo AI: dùng nhà cung cấp không phải Claude (Ollama, LM Studio, Gemini, OpenAI, OpenRouter…) — xem khachKhac.ts. */
import { t } from '../i18n/i18n';
import { MAU_NHA_KHAC, type NhaKhac } from './khachKhac';

export function CaiDatNhaKhac(p: { cfg: NhaKhac; doi: (c: Partial<NhaKhac>) => void }) {
  const { cfg, doi } = p;
  const mau = MAU_NHA_KHAC.find((m) => m.id === cfg.mau) ?? MAU_NHA_KHAC[MAU_NHA_KHAC.length - 1];
  return (
    <details class="leo-muc leo-nang-cao" open={cfg.dung}>
      <summary>{t('leo.khac.tieuDe')}</summary>
      <label class="leo-chon"><input type="checkbox" checked={cfg.dung} onChange={(e) => doi({ dung: e.currentTarget.checked })} /><span><b>{t('leo.khac.dung')}</b><small>{t('leo.khac.dungGiai')}</small></span></label>
      <label class="leo-chon-nguon">
        <span>{t('leo.khac.nhaCungCap')}</span>
        <select value={mau.id} onChange={(e) => { const m = MAU_NHA_KHAC.find((x) => x.id === e.currentTarget.value); if (m) doi({ mau: m.id, ...(m.url ? { url: m.url } : {}) }); }}>
          {MAU_NHA_KHAC.map((m) => <option key={m.id} value={m.id}>{m.ten}</option>)}
        </select>
      </label>
      <label class="leo-chon-nguon">
        <span>{t('leo.khac.url')}</span>
        <input type="text" spellcheck={false} autoComplete="off" value={cfg.url} placeholder="http://localhost:11434/v1" onInput={(e) => doi({ url: e.currentTarget.value })} />
      </label>
      <label class="leo-chon-nguon">
        <span>{t('leo.khac.moHinh')}</span>
        <input type="text" spellcheck={false} autoComplete="off" value={cfg.moHinh} placeholder={mau.goiY || t('leo.khac.moHinhGoiY')} onInput={(e) => doi({ moHinh: e.currentTarget.value })} />
      </label>
      <label class="leo-chon-nguon">
        <span>{t('leo.khac.khoa')}{mau.canKhoa ? '' : ` (${t('leo.khac.khongBat')})`}</span>
        <input type="password" spellcheck={false} autoComplete="off" value={cfg.khoa} onInput={(e) => doi({ khoa: e.currentTarget.value })} aria-label={t('leo.khac.khoa')} />
      </label>
      <label class="leo-chon"><input type="checkbox" checked={cfg.congCu} onChange={(e) => doi({ congCu: e.currentTarget.checked })} /><span><b>{t('leo.khac.congCu')}</b><small>{t('leo.khac.congCuGiai')}</small></span></label>
      <p class="muted">{t('leo.khac.ghiChu')}</p>
    </details>
  );
}
