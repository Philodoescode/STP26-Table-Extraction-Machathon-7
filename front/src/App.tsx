import './App.css'
import DotGrid from '@/components/DotGrid'
import RotatingText from './components/RotatingText'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import ExtractPage from './pages/Extract'

function Home() {
  const navigate = useNavigate();
  
  return (
    /* 
      By using h-full and explicitly setting overflow-y-scroll on this exact element 
      (while the parent remains overflow-hidden), we guarantee browser scroll-snapping behaves correctly.
    */
    <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none] scroll-smooth relative z-10">
      
      {/* Slide 1: The Landing Hero */}
      <section className="h-full w-full shrink-0 snap-start snap-always flex flex-col items-center justify-center px-6 md:px-12 lg:px-20 text-center relative z-10">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center w-full">
          
          <div className="flex flex-col sm:flex-row items-center justify-center flex-wrap gap-x-4 gap-y-3 text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-foreground mb-8">
            <span className="select-none text-white">Precise</span>
            
            <RotatingText
              texts={['Extraction', 'Parsing', 'Logic']}
              mainClassName="font-playwrite px-5 sm:px-8 bg-primary text-primary-foreground overflow-hidden py-1 sm:py-2 justify-center rounded-2xl md:rounded-3xl"
              staggerFrom="last"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-1 sm:pb-2"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2500}
              animatePresenceMode="popLayout" 
            />
          </div>

          <p className="text-base md:text-xl text-gray-400 mb-12 max-w-2xl">
            High-precision AI designed to interpret complex document structures, transforming unstructured visuals and raw PDFs into organized tabular data effortlessly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto">
           <button 
              onClick={() => navigate('/extract')}
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-black text-sm hover:bg-gray-200 transition-colors duration-300 uppercase font-sans"
            >
              Start Extracting
            </button>

            <button className="w-full sm:w-auto px-10 py-4 rounded-full bg-transparent border border-white/20 text-white text-sm hover:bg-white/10 transition-colors duration-300 uppercase font-sans">
              Documentation
            </button>
          </div>
        </div>

        {/* Typographic Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-40 animate-pulse pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white font-medium">Scroll</span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-white to-transparent"></div>
        </div>
      </section>

      {/* Slide 2: Features & Content */}
      <section className="h-full w-full shrink-0 snap-start snap-always flex flex-col justify-center px-6 lg:px-20 relative bg-transparent backdrop-blur-md z-10">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          <div className="flex flex-col justify-center text-left">
            <h2 className="text-5xl lg:text-7xl font-medium text-white mb-6 tracking-tight leading-tight">
              Structured <br/> <span className="text-primary">Intelligence.</span>
            </h2>
            <p className="text-lg lg:text-xl text-gray-400 font-light leading-relaxed max-w-md">
              We trained our model on millions of highly dense grids, bypassing traditional extraction limits to read semantic relationships exactly like a human would.
            </p>
          </div>
          
          <div className="flex flex-col justify-center gap-12 text-left">
            
            <div className="border-l-2 border-primary/40 pl-6 lg:pl-8 py-1">
              <span className="text-[10px] font-mono text-primary tracking-[0.2em] mb-3 block uppercase">01 / Logical Inference</span>
              <h3 className="text-xl md:text-2xl font-medium text-white mb-3 tracking-wide">Contextual Grids</h3>
              <p className="text-sm lg:text-base text-gray-400 font-light leading-relaxed">
                Instead of blindly mapping detected lines, the engine recreates the structural relationships between rows and columns, interpreting blank space perfectly.
              </p>
            </div>
            
            <div className="border-l-2 border-primary/40 pl-6 lg:pl-8 py-1">
              <span className="text-[10px] font-mono text-primary tracking-[0.2em] mb-3 block uppercase">02 / Pure Output</span>
              <h3 className="text-xl md:text-2xl font-medium text-white mb-3 tracking-wide">Lossless Format</h3>
              <p className="text-sm lg:text-base text-gray-400 font-light leading-relaxed">
                Spanning headers, merged cells, and completely borderless sections are retained and accurately nested for immediate use in standard workflows.
              </p>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}

function App() {
  return (
    <Router>
      {/* 
        This clamp ensures the viewport is totally isolated to exactly 100% height,
        acting as the rigid boundary for child scrolling views to snap accurately.
      */}
      <main className="dark h-[100dvh] w-full overflow-hidden text-foreground font-sans relative z-0 bg-[#120F17]">

        {/* Background Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <DotGrid 
            baseColor="#262624"  
            activeColor="#9b2c2c" 
            dotSize={3} 
          />
        </div>

        <div className="relative z-10 h-full w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/extract" element={<ExtractPage />} />
          </Routes>
        </div>
        
      </main>
    </Router>
  )
}

export default App