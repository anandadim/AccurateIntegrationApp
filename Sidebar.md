Perubahan yang Dilakukan
1. Sidebar Component Baru (e:\web\AccurateIntegrationApp\frontend\src\components\Sidebar.vue)
Sidebar dengan tema gelap modern dan gradient background
Navigasi terorganisir dalam beberapa section:
Sales: Sales Invoice, Sales Receipt, Sales Order, Sales Return
Purchase: Purchase Invoice, Purchase Order
SRP Integration: SRP Inventory, SRP Sales, SRP Item Master
Master Data: Customers, Items
Tools: API Testing
Responsive dengan hamburger menu untuk mobile
Active state highlighting dan hover effects
Custom scrollbar styling
2. Update App.vue
Mengganti top navigation buttons dengan Sidebar component
Menambahkan page header dengan dynamic title
Layout baru dengan sidebar di kiri dan content di kanan
SrpActivityTicker tetap tidak berubah sesuai permintaan
3. Update Styles (e:\web\AccurateIntegrationApp\frontend\src\style.css)
Layout flexbox untuk sidebar + main content
Responsive breakpoints (1024px dan 768px)
Sidebar otomatis tersembunyi pada mobile dengan hamburger menu
Styling yang konsisten untuk semua komponen
Fitur Sidebar
✅ Navigasi terorganisir dengan section yang jelas
✅ Responsive design untuk desktop dan mobile
✅ Smooth transitions dan hover effects
✅ Active state indicator
✅ Dark theme yang modern
✅ Mudah untuk menambah endpoint baru di masa depan