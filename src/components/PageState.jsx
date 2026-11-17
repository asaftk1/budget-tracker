// Loading, error and empty states shared by the pages that read from DataContext.
//   loading   show a status line instead of the content
//   error     Hebrew message from the provider. With no data it replaces the content; when data had
//             already loaded it shows above the content, which stays visible.
//   hasData   whether any data is available to show
//   isEmpty   the loaded data is empty: show emptyMessage instead of the content
export default function PageState({ loading, error, hasData, isEmpty, emptyMessage, children }) {
  if (loading) {
    return <p role="status" className="text-gray-600 p-4">טוען נתונים…</p>;
  }
  if (error && !hasData) {
    return <p role="alert" className="text-red-600 p-4">{error}</p>;
  }
  if (!error && isEmpty) {
    return <p role="status" className="text-gray-600 p-4">{emptyMessage}</p>;
  }
  return (
    <>
      {error && <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>}
      {children}
    </>
  );
}
