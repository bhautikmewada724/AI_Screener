import RoleLayout from './RoleLayout';

const AdminLayout = () => {
  return <RoleLayout allowedRoles={['admin']} navRole="admin" />;
};

export default AdminLayout;


