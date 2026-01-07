<template>
  <div class="sidebar-container">
    <button 
      class="hamburger" 
      @click="toggleSidebar"
      :class="{ active: isOpen }"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <aside class="sidebar" :class="{ open: isOpen }">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">🔗</span>
          <span class="logo-text">API Integration App</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Accurate API</div>
          <div class="dropdown">
            <a
              href="#"
              class="nav-item dropdown-toggle"
              :class="{ active: ['invoice-sync', 'receipt-sync', 'order-sync', 'return-sync', 'purchase-invoice-sync', 'purchase-order-sync', 'customer-sync', 'item-sync'].includes(currentView) }"
              @click.prevent="toggleDropdown('accurate')"
            >
              <span class="nav-icon"></span>
              <span class="nav-text">Accurate Integration</span>
              <span class="dropdown-arrow" :class="{ open: openDropdown === 'accurate' }">▼</span>
            </a>
            <div class="dropdown-menu" :class="{ open: openDropdown === 'accurate' }">
              <div class="dropdown-subtitle">Sales</div>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'invoice-sync' }"
                @click.prevent="navigate('invoice-sync')"
              >
                <span class="nav-icon">📋</span>
                <span class="nav-text">Sales Invoice</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'receipt-sync' }"
                @click.prevent="navigate('receipt-sync')"
              >
                <span class="nav-icon">💰</span>
                <span class="nav-text">Sales Receipt</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'order-sync' }"
                @click.prevent="navigate('order-sync')"
              >
                <span class="nav-icon">📦</span>
                <span class="nav-text">Sales Order</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'return-sync' }"
                @click.prevent="navigate('return-sync')"
              >
                <span class="nav-icon">↩️</span>
                <span class="nav-text">Sales Return</span>
              </a>
              <div class="dropdown-subtitle">Purchase</div>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'purchase-invoice-sync' }"
                @click.prevent="navigate('purchase-invoice-sync')"
              >
                <span class="nav-icon">📋</span>
                <span class="nav-text">Purchase Invoice</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'purchase-order-sync' }"
                @click.prevent="navigate('purchase-order-sync')"
              >
                <span class="nav-icon">📝</span>
                <span class="nav-text">Purchase Order</span>
              </a>
              <div class="dropdown-subtitle">Master Data</div>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'customer-sync' }"
                @click.prevent="navigate('customer-sync')"
              >
                <span class="nav-icon">👥</span>
                <span class="nav-text">Customers</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'item-sync' }"
                @click.prevent="navigate('item-sync')"
              >
                <span class="nav-icon">📦</span>
                <span class="nav-text">Items</span>
              </a>
            </div>
          </div>

        </div>

        <div class="nav-section">
          <div class="nav-section-title">SRP API</div>
          <div class="dropdown">
            <a
              href="#"
              class="nav-item dropdown-toggle"
              :class="{ active: currentView.startsWith('srp-') || currentView === 'item-master' }"
              @click.prevent="toggleDropdown('srp')"
            >
              <span class="nav-icon"></span>
              <span class="nav-text">SRP Integration</span>
              <span class="dropdown-arrow" :class="{ open: openDropdown === 'srp' }">▼</span>
            </a>
            <div class="dropdown-menu" :class="{ open: openDropdown === 'srp' }">
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'srp-inventory-sync' }"
                @click.prevent="navigate('srp-inventory-sync')"
              >
                <span class="nav-icon">🏪</span>
                <span class="nav-text">Inventory</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'item-master' }"
                @click.prevent="navigate('item-master')"
              >
                <span class="nav-icon">📋</span>
                <span class="nav-text">Item Master</span>
              </a>
              <a
                href="#"
                class="nav-item dropdown-item"
                :class="{ active: currentView === 'srp-sales-sync' }"
                @click.prevent="navigate('srp-sales-sync')"
              >
                <span class="nav-icon">🧾</span>
                <span class="nav-text">Sales Detail</span>
              </a>
            </div>
          </div>
        </div>

        <div class="nav-section tools-section">
          <div class="nav-section-title">Tools</div>
          <a
            href="#"
            class="nav-item"
            :class="{ active: currentView === 'api' }"
            @click.prevent="navigate('api')"
          >
            <span class="nav-icon">🔌</span>
            <span class="nav-text">API Testing</span>
          </a>
          <a
            href="#"
            class="nav-item"
            :class="{ active: currentView === 'scheduler-config' }"
            @click.prevent="navigate('scheduler-config')"
          >
            <span class="nav-icon">⏰</span>
            <span class="nav-text">Scheduler Config</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="footer-info">
          <span class="footer-icon">⚡</span>
          <span class="footer-text">v2.1.0 - llynn</span>
        </div>
      </div>
    </aside>

    <div class="overlay" :class="{ active: isOpen }" @click="toggleSidebar"></div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'Sidebar',
  props: {
    currentView: {
      type: String,
      required: true
    }
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const isOpen = ref(false)
    const openDropdown = ref(null)

    const toggleSidebar = () => {
      isOpen.value = !isOpen.value
    }

    const toggleDropdown = (dropdownName) => {
      if (openDropdown.value === dropdownName) {
        openDropdown.value = null
      } else {
        openDropdown.value = dropdownName
      }
    }

    const navigate = (view) => {
      emit('navigate', view)
      isOpen.value = false
    }

    return {
      isOpen,
      openDropdown,
      toggleSidebar,
      toggleDropdown,
      navigate
    }
  }
}
</script>

<style scoped>
.sidebar-container {
  display: flex;
  align-items: flex-start;
}

.hamburger {
  display: none;
  flex-direction: column;
  justify-content: space-around;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  position: fixed;
  top: 16px;
  left: 16px;
}

.hamburger span {
  width: 25px;
  height: 3px;
  background: #42b983;
  border-radius: 3px;
  transition: all 0.3s ease;
}

.hamburger.active span:nth-child(1) {
  transform: rotate(45deg) translate(8px, 8px);
}

.hamburger.active span:nth-child(2) {
  opacity: 0;
}

.hamburger.active span:nth-child(3) {
  transform: rotate(-45deg) translate(7px, -7px);
}

.sidebar {
  width: 280px;
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease;
  z-index: 1000;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.5px;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 8px;
}

.nav-section-title {
  padding: 12px 24px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.4);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  margin: 0 8px;
  border-radius: 0 8px 8px 0;
}

.nav-item:hover {
  background: rgba(66, 185, 131, 0.1);
  color: #ffffff;
  border-left-color: #42b983;
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(66, 185, 131, 0.2) 0%, transparent 100%);
  color: #42b983;
  border-left-color: #42b983;
  font-weight: 600;
}

.nav-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.nav-text {
  font-size: 14px;
  white-space: nowrap;
}

.dropdown {
  margin: 0 8px;
}

.dropdown-toggle {
  justify-content: space-between;
  padding-right: 20px;
}

.dropdown-arrow {
  font-size: 10px;
  transition: transform 0.3s ease;
  margin-left: auto;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0 0 8px 8px;
  margin: 0 -8px;
}

.dropdown-menu.open {
  max-height: 500px;
}

.dropdown-item {
  padding: 10px 24px 10px 48px;
  font-size: 13px;
  border-left: none;
  border-radius: 0;
  margin: 0;
}

.dropdown-item:hover {
  background: rgba(66, 185, 131, 0.15);
  border-left: none;
}

.dropdown-item.active {
  background: linear-gradient(90deg, rgba(66, 185, 131, 0.15) 0%, transparent 100%);
  border-left: none;
  padding-left: 52px;
}

.dropdown-subtitle {
  padding: 10px 24px 6px 24px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 4px;
}

.tools-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.footer-icon {
  font-size: 14px;
}

.overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.overlay.active {
  display: block;
  opacity: 1;
}

@media (max-width: 1024px) {
  .sidebar {
    transform: translateX(-100%);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .hamburger {
    display: flex;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    max-width: 300px;
  }
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
