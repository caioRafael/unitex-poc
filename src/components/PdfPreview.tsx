interface PdfPreviewProps {
    urlPdf: string;
}

export function PdfPreview({ urlPdf }: PdfPreviewProps) {
    return (
        <div className="flex flex-row justify-center items-center h-screen w-screen bg-gray-100">
        <iframe src={urlPdf} className="w-full h-full" title="PDF Preview" />
      </div>
    )
}