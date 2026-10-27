import { render } from 'preact';
import { LocationProvider, Route, Router } from 'preact-iso';
import './styles/leo-ui.css';
import './styles/unitmix.css';
import './styles/so-sanh.css';
import { langHienTai } from './i18n/i18n';
import { DuAn } from './man/DuAn';
import { SoanThao } from './man/SoanThao';

document.documentElement.lang = langHienTai();

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
