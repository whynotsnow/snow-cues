import { AppView } from "./ui/AppView";
import { useAppController } from "./ui/useAppController";

export default function App() {
  const controller = useAppController();

  return <AppView controller={controller} />;
}
