import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import JoinRoom from "@/pages/JoinRoom";
import MasterDashboard from "@/pages/MasterDashboard";
import PlayerView from "@/pages/PlayerView";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/master/:code" element={<MasterDashboard />} />
          <Route path="/play/:code" element={<PlayerView />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" richColors position="top-center" />
    </div>
  );
}

export default App;
