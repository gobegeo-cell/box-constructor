export async function downloadFile(data: Blob | string, fileName: string): Promise<void> {
  let url: string;
  let revokeAfter = false;

  if (typeof data === 'string') {
    url = data;
  } else {
    url = URL.createObjectURL(data);
    revokeAfter = true;
  }

  return new Promise((resolve) => {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);

    link.addEventListener('click', () => {
      setTimeout(() => {
        document.body.removeChild(link);
        if (revokeAfter) URL.revokeObjectURL(url);
        resolve();
      }, 100);
    });

    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
        if (revokeAfter) URL.revokeObjectURL(url);
        resolve();
      }
    }, 1000);
  });
}
