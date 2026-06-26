import { PwaUpdateBanner } from "./ui/components/PwaUpdateBanner";
import { AppView } from "./ui/AppView";
import { useAppController } from "./ui/useAppController";

export default function App() {
  const controller = useAppController();

  return (
    <>
      <PwaUpdateBanner />
      <AppView controller={controller} />
    </>
  );
}
