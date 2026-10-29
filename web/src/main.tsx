import { render } from 'preact';
import { LocationProvider, Route, Router } from 'preact-iso';
import './styles/leo-ui.css';
import './styles/unitmix.css';
import './styles/chuyen-dong.css';
import './styles/tuan-thu.css';
import './styles/so-sanh.css';
import './styles/preset.css';
import './styles/ham.css';
import './styles/o-can.css';
import './styles/phong.css';
import './styles/chi-phi.css';
import './styles/xep-toa.css';
import './styles/stretch.css';
import './styles/bieu-tuong.css';
import './styles/tmb-thao-tac.css';
import './styles/chon-3d.css';
import './styles/xep-hang-loat.css';
import './styles/cong-cu-tang.css';
import './styles/cap-do.css';
import './styles/tai-luoi.css';
import './styles/dien-thoai.css';
import './styles/man-hinh-chinh.css';
import './styles/du-an.css';
import { langHienTai } from './i18n/i18n';
import { dangKySW } from './pwa/dangKySW';
import { DuAn } from './man/DuAn';
import { SoanThao } from './man/SoanThao';
import { theoDoiKhungNhin } from './ui/manHep';

document.documentElement.lang = langHienTai();
theoDoiKhungNhin();

function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/" component={DuAn} />
        <Route path="/du-an/:ma" component={SoanThao} />
      </Router>
    </LocationProvider>
  );
}

render(<App />, document.getElementById('app')!);
dangKySW();
