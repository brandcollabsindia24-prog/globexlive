import Contact from "../models/Contact";

export const submitContact = async (req: any, res: any) => {
  try {
    const { name, email, whatsapp, subject, message, userType } = req.body;

    if (!name || !email || !whatsapp || !subject || !message || !userType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(String(email))) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!/^\d{10}$/.test(String(whatsapp))) {
      return res.status(400).json({ message: "WhatsApp number must be 10 digits" });
    }

    const payload = {
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      whatsapp: String(whatsapp).trim(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      userType: userType === "brand" ? "brand" : "influencer",
    };

    await Contact.create(payload);

    return res.status(201).json({ message: "Message submitted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
