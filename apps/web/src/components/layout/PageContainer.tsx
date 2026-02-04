import { Header } from './Header';

interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageContainer({ title, description, children, actions }: PageContainerProps) {
  return (
    <div className="flex flex-col h-full">
      <Header title={title} description={description} />
      {actions && (
        <div className="flex items-center justify-end px-6 py-4 bg-white border-b border-gray-200">
          {actions}
        </div>
      )}
      <div className="flex-1 p-6 overflow-auto">{children}</div>
    </div>
  );
}
