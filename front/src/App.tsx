import './App.css'
import DotGrid from '@/components/DotGrid'
import RotatingText from './components/RotatingText'

function App() {
  return (
    // FIX: Removed 'bg-[#120F17]' from <main>. Now it's transparent, letting the dots show through!
    <main className="dark min-h-screen w-full text-foreground font-sans relative">
      
      {/* Background Layer - This handles the solid color AND the dots now */}
      <div className="fixed inset-0 -z-10 bg-[#120F17]">
        <DotGrid 
          baseColor="#2F293A"  
          activeColor="#5227FF" 
          dotSize={3} 
        />
      </div>

      {/* Hero Section */}
      <section id="center" className="flex flex-col items-center justify-center min-h-screen w-full px-4 text-center">
        <div className="hero flex flex-col items-center max-w-4xl mx-auto">
          
          {/* Main Hero Typography */}
          <div className="flex flex-row items-center justify-center flex-wrap gap-x-3 gap-y-2 text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-foreground mb-6">
            <span className="select-none text-white">Precise</span>
            
            <RotatingText
              texts={['Extraction', 'Parsing', 'Layouts', 'Logic']}
              mainClassName="px-3 sm:px-5 md:px-6 bg-primary text-primary-foreground overflow-hidden py-1 sm:py-2 justify-center rounded-xl md:rounded-2xl"
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

          {/* Sub-headline */}
          <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
            High-precision AI for converting complex tables from PDFs and images into clean, usable formats.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            {/* Primary CTA */}
            <button className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity duration-200 shadow-lg shadow-primary/20">
              Extract now
            </button>
            
            {/* Secondary CTA */}
            <button className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-transparent border border-border text-white font-medium hover:bg-white/10 transition-colors duration-200">
              View Documentation
            </button>
          </div>

        </div>
      </section>
    </main>
  )
}

export default App