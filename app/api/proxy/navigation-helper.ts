// app/api/simple-proxy/navigation-helper.ts

// This script will be injected into proxied pages to add a navigation bar
export const createNavigationScript = (serviceName: string) => {
    return `
      <style>
        #freedom-dashboard-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          z-index: 999999999;
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          backdrop-filter: blur(4px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        #freedom-dashboard-nav.hidden {
          transform: translateY(-36px);
        }
        #freedom-dashboard-nav button {
          background-color: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          margin-right: 8px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }
        #freedom-dashboard-nav button:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }
        #freedom-dashboard-nav .title {
          font-weight: bold;
          margin-right: auto;
        }
        #freedom-dashboard-nav .show-hide {
          margin-left: auto;
          cursor: pointer;
          opacity: 0.7;
        }
        #freedom-dashboard-nav .show-hide:hover {
          opacity: 1;
        }
        #freedom-dashboard-toggle {
          position: fixed;
          top: 0;
          right: 16px;
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          border: none;
          border-bottom-left-radius: 4px;
          border-bottom-right-radius: 4px;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
          z-index: 999999999;
          transform: translateY(-100%);
          transition: transform 0.3s;
        }
        #freedom-dashboard-toggle.visible {
          transform: translateY(0);
        }
        body {
          margin-top: 36px !important;
        }
      </style>
      <div id="freedom-dashboard-nav">
        <div class="title">Freedom Dashboard: ${serviceName}</div>
        <button onclick="window.location.href='/'">Back to Dashboard</button>
        <button onclick="window.location.reload()">Refresh</button>
        <div class="show-hide" onclick="toggleNav()">Hide</div>
      </div>
      <button id="freedom-dashboard-toggle" class="hidden" onclick="toggleNav()">Show Controls</button>
      <script>
        function toggleNav() {
          const nav = document.getElementById('freedom-dashboard-nav');
          const toggle = document.getElementById('freedom-dashboard-toggle');
          
          if (nav.classList.contains('hidden')) {
            nav.classList.remove('hidden');
            toggle.classList.remove('visible');
            document.body.style.marginTop = '36px';
          } else {
            nav.classList.add('hidden');
            toggle.classList.add('visible');
            document.body.style.marginTop = '0';
          }
        }
        
        // Store navigation state in localStorage
        const navState = localStorage.getItem('freedom-dashboard-nav-state');
        if (navState === 'hidden') {
          toggleNav();
        }
        
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'visible') {
            // Update the nav state when the page becomes visible again
            const nav = document.getElementById('freedom-dashboard-nav');
            localStorage.setItem('freedom-dashboard-nav-state', 
              nav.classList.contains('hidden') ? 'hidden' : 'visible');
          }
        });
      </script>
    `;
  };