import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

// export const seedSuperAdmin = async () => {
//   try {
//     const isSuperAdminExist = await prisma.user.findFirst({
//       where: {
//         role: Role.SUPER_ADMIN,
//       },
//     });

//     if (isSuperAdminExist) {
//       console.log("Super Admin Already Exists!");
//       return;
//     }

//     const name = config.super_admin_name;
//     const email = config.super_admin_email;
//     const password = config.super_admin_password;

//     if (!name || !email || !password) {
//       throw new Error(
//         "Super Admin Name , Email, Password Missing In Env File!!!",
//       );
//     }

//     const hashedPassword = await bcrypt.hash(
//       password,
//       Number(config.bcrypt_salt_rounds),
//     );

//     const superAdmin = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         role: Role.SUPER_ADMIN,
//         needPasswordChange: false,
//         emailVerified: true,
//       },
//     });

//     console.log("Super Admin Created : ", superAdmin);
//   } catch (error) {
//     console.log("Error Seeding Super Admin : ", error);

//     if (config.super_admin_email) {
//       await prisma.user.deleteMany({
//         where: { email: config.super_admin_email },
//       });
//     }
//   }
// };

// export const seedTesterAdmin = async () => {
//   try {
//     const isTesterAdminExist = await prisma.user.findUnique({
//       where: {
//         email: config.tester_admin_email,
//       },
//     });

//     if (isTesterAdminExist) {
//       console.log("Tester Admin Already Exists!");
//       return;
//     }

//     const name = config.tester_admin_name;
//     const email = config.tester_admin_email;
//     const password = config.tester_admin_password;

//     if (!name || !email || !password) {
//       throw new Error(
//         "Tester Admin Name , Email, Password Missing In Env File!!!",
//       );
//     }

//     const hashedPassword = await bcrypt.hash(
//       password,
//       Number(config.bcrypt_salt_rounds),
//     );

//     const testerAdmin = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         role: Role.ADMIN,
//         needPasswordChange: false,
//         emailVerified: true,
//       },
//     });

//     console.log("Tester Admin Created : ", testerAdmin);
//   } catch (error) {
//     console.log("Error Seeding Tester Admin : ", error);

//     if (config.tester_admin_email) {
//       await prisma.user.deleteMany({
//         where: { email: config.tester_admin_email },
//       });
//     }
//   }
// };

export const seedTesterTechnician = async () => {
  try {
    const isTesterTechnicianExist = await prisma.user.findUnique({
      where: {
        email: config.tester_tecnician_email,
      },
    });

    if (isTesterTechnicianExist) {
      console.log("Tester Technician Already Exists!");
      return;
    }

    const name = config.tester_tecnician_name;
    const email = config.tester_tecnician_email;
    const password = config.tester_tecnician_password;

    if (!name || !email || !password) {
      throw new Error(
        "Tester Technician Name , Email, Password Missing In Env File!!!",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const testerTechnician = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.TECHNICIAN,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    await prisma.technician.create({
      data: {
        userId: testerTechnician.id,
        name: testerTechnician.name,
        email: testerTechnician.email,
      },
    });

    console.log("Tester Technician Created : ", testerTechnician);
  } catch (error) {
    console.log("Error Seeding Tester Technician : ", error);

    if (config.tester_tecnician_email) {
      await prisma.user.deleteMany({
        where: { email: config.tester_tecnician_email },
      });
    }
  }
};

export const seedTesterManager = async () => {
  try {
    const isTesterManagerExist = await prisma.user.findUnique({
      where: {
        email: config.tester_manager_email,
      },
    });

    if (isTesterManagerExist) {
      console.log("Tester Manager Already Exists!");
      return;
    }

    const name = config.tester_manager_name;
    const email = config.tester_manager_email;
    const password = config.tester_manager_password;

    if (!name || !email || !password) {
      throw new Error(
        "Tester Manager Name , Email, Password Missing In Env File!!!",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const testerManager = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.MANAGER,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    await prisma.manager.create({
      data: {
        userId: testerManager.id,
        department: "Operations",
        name: testerManager.name,
        email: testerManager.email,
      },
    });

    console.log("Tester Manager Created : ", testerManager);
  } catch (error) {
    console.log("Error Seeding Tester Manager : ", error);

    if (config.tester_manager_email) {
      await prisma.user.deleteMany({
        where: { email: config.tester_manager_email },
      });
    }
  }
};
