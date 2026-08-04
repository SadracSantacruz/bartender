import { useAppStore } from "./store/appStore";
import Home from "./screens/Home";
import Browse from "./screens/Browse";
import Review from "./screens/Review";
import MultipleChoice from "./screens/MultipleChoice";
import FullBuildRecall from "./screens/FullBuildRecall";
import ReverseRecall from "./screens/ReverseRecall";
import RapidFire from "./screens/RapidFire";
import TicketMode from "./screens/TicketMode";
import Dashboard from "./screens/Dashboard";
import Import from "./screens/Import";

function App() {
  const screen = useAppStore((s) => s.screen);

  switch (screen) {
    case "home":
      return <Home />;
    case "browse":
      return <Browse />;
    case "review":
      return <Review />;
    case "mc":
      return <MultipleChoice />;
    case "fullbuild":
      return <FullBuildRecall />;
    case "reverse":
      return <ReverseRecall />;
    case "rapidfire":
      return <RapidFire />;
    case "ticket":
      return <TicketMode />;
    case "dashboard":
      return <Dashboard />;
    case "import":
      return <Import />;
    default:
      return <Home />;
  }
}

export default App;
