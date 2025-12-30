export default function Head() {
  return (
    <>
      <title>Objective Studio</title>
      <link rel="stylesheet" href={`/template-studio.css?v=${Date.now()}`} />
    </>
  );
}
