import { getPrintSettings } from './printSettings';

/**
 * Executes a clean print layout inside a sandbox browser window.
 * Avoids main-window pollution (sidebars, backgrounds, modals) and dynamically
 * applies user margins, paddings, and theme configurations.
 */
export function printIsolatedHtml(title: string, htmlContent: string) {
  const settings = getPrintSettings();
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Please enable browser popups to allow clinical printing operations.');
    return;
  }

  // Generate robust style injection block supporting both A4 sheet templates and 3-inch thermal presets
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
    
    @page {
      size: ${settings.paperSize === 'A4' ? 'A4 portrait' : 'auto'};
      margin: ${settings.margin}mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: ${settings.paperSize === 'A4' ? "'Inter', system-ui, -apple-system, sans-serif" : "monospace"};
      font-size: ${settings.fontSize}px;
      padding: ${settings.padding}px;
      color: #000000;
      background-color: #ffffff;
      line-height: 1.4;
      margin: 0;
      width: ${settings.paperSize === 'A4' ? '100%' : '72mm'};
      margin-left: auto;
      margin-right: auto;
    }
    
    /* Branding Accent Injection */
    .brand-accent-text {
      color: ${settings.accentColor} !important;
    }
    
    .brand-accent-bg {
      background-color: ${settings.accentColor} !important;
      color: #ffffff !important;
    }
    
    .brand-accent-border {
      border-color: ${settings.accentColor} !important;
    }
    
    /* Universal layout/alignment classes inside templates */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .font-black { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .w-full { width: 100%; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .gap-2 { gap: 8px; }
    
    .barcode-container {
      height: 24px;
      width: 100%;
      background-color: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 7px;
      letter-spacing: 5px;
      font-weight: bold;
      margin: 8px 0;
      border-radius: 4px;
    }
    
    .dashed-divider {
      border-top: 1px dashed #cbd5e1;
      margin: 8px 0;
    }
    
    .solid-divider {
      border-top: 1px solid #1e293b;
      margin: 8px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }

    th {
      border-bottom: 1.5px solid #000000;
      padding: 6px 4px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 0.95em;
    }

    td {
      padding: 6px 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    @media print {
      body {
        width: ${settings.paperSize === 'A4' ? '100%' : '100%'};
        margin: 0;
        padding: ${settings.padding}px;
      }
    }
  `;

  const rawHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>${styles}</style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(rawHtml);
  printWindow.document.close();
}
