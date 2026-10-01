async function run() {
  const machineId = "FC538EBA-115E-5E81-A9C0-FB909E47CA79"; // the device
  const key = "OB-BCB6-2397-70C5-8BBE";
  
  const response = await fetch('https://sqibniuqbkgexipynfkx.supabase.co/functions/v1/activate-license', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          licenseKey: key,
          deviceId: machineId,
          deviceName: 'OneBook POS',
          operatingSystem: 'macOS',
          appVersion: '1.0.0'
      })
  });
  
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

run();
