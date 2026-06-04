import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Activate } from './pages/auth/Activate';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RoleRoute } from './components/layout/RoleRoute';

import { SuperAdminDashboard } from './pages/dashboards/SuperAdminDashboard';
import { SuperAdminHospitals } from './pages/dashboards/SuperAdminHospitals';
import { SuperAdminLicenses } from './pages/dashboards/SuperAdminLicenses';
import { SuperAdminFinancials } from './pages/dashboards/SuperAdminFinancials';
import { SuperAdminPlans } from './pages/dashboards/SuperAdminPlans';
import { SuperAdminSettings } from './pages/dashboards/SuperAdminSettings';

import { HospitalAdminDashboard } from './pages/dashboards/HospitalAdminDashboard';
import { HospitalAdminStaff } from './pages/dashboards/HospitalAdminStaff';
import { HospitalAdminDepartments } from './pages/dashboards/HospitalAdminDepartments';
import { HospitalAdminAppointments } from './pages/dashboards/HospitalAdminAppointments';
import { HospitalAdminAnalytics } from './pages/dashboards/HospitalAdminAnalytics';
import { HospitalAdminBilling } from './pages/dashboards/HospitalAdminBilling';

import { ReceptionistDashboard } from './pages/dashboards/ReceptionistDashboard';
import { ReceptionistAppointments } from './pages/dashboards/ReceptionistAppointments';
import { ReceptionistPatients } from './pages/dashboards/ReceptionistPatients';
import { ReceptionistInvoices } from './pages/dashboards/ReceptionistInvoices';

import { DoctorDashboard } from './pages/dashboards/DoctorDashboard';
import { DoctorSearch } from './pages/dashboards/DoctorSearch';
import { DoctorProfile } from './pages/dashboards/DoctorProfile';

import { PharmacyDashboard } from './pages/dashboards/PharmacyDashboard';
import { PharmacyInventory } from './pages/dashboards/PharmacyInventory';
import { PharmacyAlerts } from './pages/dashboards/PharmacyAlerts';
import { PharmacyOrders } from './pages/dashboards/PharmacyOrders';

function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<Activate />} />
        <Route path="/setup" element={<Activate />} />

        {/* Super Admin Routes */}
        <Route path="/super-admin" element={
          <RoleRoute allowedRoles={['SUPER_ADMIN']}>
            <DashboardLayout />
          </RoleRoute>
        }>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="hospitals" element={<SuperAdminHospitals />} />
          <Route path="licenses" element={<SuperAdminLicenses />} />
          <Route path="plans" element={<SuperAdminPlans />} />
          <Route path="financials" element={<SuperAdminFinancials />} />
          <Route path="settings" element={<SuperAdminSettings />} />
        </Route>

        {/* Hospital Admin Routes */}
        <Route path="/hospital-admin" element={
          <RoleRoute allowedRoles={['HOSPITAL_ADMIN']}>
            <DashboardLayout />
          </RoleRoute>
        }>
          <Route index element={<HospitalAdminDashboard />} />
          <Route path="staff" element={<HospitalAdminStaff />} />
          <Route path="departments" element={<HospitalAdminDepartments />} />
          <Route path="appointments" element={<HospitalAdminAppointments />} />
          <Route path="analytics" element={<HospitalAdminAnalytics />} />
          <Route path="billing" element={<HospitalAdminBilling />} />
        </Route>

        {/* Receptionist Routes */}
        <Route path="/receptionist" element={
          <RoleRoute allowedRoles={['RECEPTIONIST']}>
            <DashboardLayout />
          </RoleRoute>
        }>
          <Route index element={<ReceptionistDashboard />} />
          <Route path="appointments" element={<ReceptionistAppointments />} />
          <Route path="patients" element={<ReceptionistPatients />} />
          <Route path="invoices" element={<ReceptionistInvoices />} />
        </Route>

        {/* Doctor Routes */}
        <Route path="/doctor" element={
          <RoleRoute allowedRoles={['DOCTOR']}>
            <DashboardLayout />
          </RoleRoute>
        }>
          <Route index element={<DoctorDashboard />} />
          <Route path="search" element={<DoctorSearch />} />
          <Route path="profile" element={<DoctorProfile />} />
        </Route>

        {/* Pharmacy Routes */}
        <Route path="/pharmacy" element={
          <RoleRoute allowedRoles={['PHARMACY']}>
            <DashboardLayout />
          </RoleRoute>
        }>
          <Route index element={<PharmacyDashboard />} />
          <Route path="inventory" element={<PharmacyInventory />} />
          <Route path="alerts" element={<PharmacyAlerts />} />
          <Route path="orders" element={<PharmacyOrders />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
