import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'
import DotGrid from '@/components/DotGrid'
import RotatingText from './components/RotatingText'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      {/* Background Layer */}
      <div className="fixed inset-0 -z-10 bg-[#120F17]">
        <DotGrid 
          baseColor="#2F293A" 
          activeColor="#5227FF" 
          dotSize={3} 
        />
      </div>

      <section id="center" className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="hero mb-8">
          {/* Main Hero Typography */}
          <div className="flex flex-row items-center justify-center flex-wrap gap-x-4 gap-y-2 text-5xl sm:text-6xl md:text-8xl font-bold tracking-tighter text-white">
            <span className="select-none">Precise</span>
            
            <RotatingText
              texts={['Extraction', 'Parsing', 'Layouts', 'Logic']}
              mainClassName="px-4 sm:px-5 md:px-7 bg-[#5227FF] text-white overflow-hidden py-1 sm:py-2 md:py-3 justify-center rounded-2xl md:rounded-3xl"
              staggerFrom="last"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-1 sm:pb-2 md:pb-4"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2500}
              animatePresenceMode="popLayout" // Critical for smooth container resizing
            />
          </div>
        </div>

        <div className="text-center space-y-6">
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App