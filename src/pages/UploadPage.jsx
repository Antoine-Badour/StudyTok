import UploadModal from "../components/UploadModal";

export default function UploadPage() {
  return (
    <section className="mx-auto mb-24 max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-semibold text-white">Upload Study Item</h1>
      <UploadModal />
    </section>
  );
}
