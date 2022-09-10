const http = require("http");
const fs = require("fs");
const express = require("express");
const morgan = require("morgan");
const mongoose = require("mongoose");
const app = express();
const bodyParser = require("body-parser");
const server = http.createServer(app);
const path = require("path");
const fetch = require("node-fetch");
const lang = require("password-locking");
var CookieParser = require("cookie-parser");

app.use(CookieParser());
//Port
//Body Parser
app.use(bodyParser.json()).use(
  bodyParser.urlencoded({
    extended: true,
  })
);
const port = 8080;

//Socket
const { Server } = require("socket.io");
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("Kullanıcı Giriş yaptı");
  socket.on("disconnect", () => {
    console.log("Kullanıcı Çıkış yaptı");
  });
});
//Generate token
function generate_token(length) {
  var a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_".split("");
  var b = [];
  for (var i = 0; i < length; i++) {
    var j = (Math.random() * (a.length - 1)).toFixed(0);
    b[i] = a[j];
  }
  return b.join("");
}
//Generate secret
function generate_secret(length) {
  var a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
  var b = [];
  for (var i = 0; i < length; i++) {
    var j = (Math.random() * (a.length - 1)).toFixed(0);
    b[i] = a[j];
  }
  return b.join("");
}
//Generate Url
function generate_url(text) {
  let originalText = text;
  let newText = originalText.replace(/ /g, "-");
  return newText;
}
//Upload file
const multer = require("multer");
//Code Storage
const codestorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/data");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}`);
  },
});
//Photo Storage
const photostorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/data");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}.png`);
  },
});
//Storage Types
const upload_code = multer({ storage: codestorage });
const upload_photo = multer({ storage: photostorage });
//Static
app.use(express.static("public"));
app.set("src", "path/to/views");
app.use("/uploads", express.static("public/data"));
//MongoDB
const dbURL = process.env.db;
mongoose
  .connect(dbURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => {
    server.listen(port, () => {
      console.log("mongoDB Bağlantı kuruldu");
    });
  })
  .catch((err) => console.log(err));
//Collections
let Repos = require("./models/repos.js");
let Files = require("./models/files.js");
let Users = require("./models/users.js");
//Routers
//viewPort
app.set("view engine", "ejs");
//DB Support
app.use(morgan("dev"));
//Pages
//Home
app.get("/", (req, res) => {
  let token = req.cookies.token;
  if (token != null) {
    Users.findOne({ token: token }).then((userResult) => {
      res.render(`${__dirname}/src/pages/index.ejs`, {
        title: "Anasayfa",
        user: userResult,
      });
    });
    console.log(lang.translation(req.cookies.secret))
  } else {
    res.render(`${__dirname}/src/pages/index.ejs`, {
      title: "Anasayfa",
      user: false,
    });
  }
});
//Profile
app.get("/s/:url", (req, res) => {
  let userUrl = req.params.url;
  let token = req.cookies.token;
  if (token != null) {
    Users.findOne({ url: userUrl }).then((profileResult) => {
      if (profileResult != null) {
        Repos.find({ userToken: profileResult.token }).sort().then((reposResult) => {
          Files.find({ userToken: profileResult.token }).sort().then((fileResult) => {
            Users.findOne({ token: token }).then((userResult) => {
              res.render(`${__dirname}/src/pages/profile.ejs`, {
                title: userUrl,
                profile: profileResult,
                user: userResult,
                repos: reposResult,
                files: fileResult,
              });
            });
          });
        });
      } else {
        res.send("Kullanıcı Bulunamadı");
      }
    });
  } else {
    Users.findOne({ url: userUrl }).then((profileResult) => {
      Repos.find({ userToken: profileResult.token })
        .then((reposResult) => {
          Files.find({ userToken: profileResult.token }).then((fileResult) => {
            if (profileResult != null) {
              res.render(`${__dirname}/src/pages/profile.ejs`, {
                title: userUrl,
                profile: profileResult,
                user: false,
                repos: reposResult,
                files: fileResult,
              });
            }
          });
        })
        .catch((err) => {
          res.send("Hata");
        });
    });
  }
});

//Repos
app.get("/s/:url/repos", (req, res) => {
  let userUrl = req.params.url;
  let token = req.cookies.token;
  if (token != null) {
    Users.findOne({ url: userUrl }).then((profileResult) => {
      Repos.find({ userToken: profileResult.token }).then((repoResult) => {
        if (profileResult != null) {
          Users.findOne({ token: token }).then((userResult) => {
            res.render(`${__dirname}/src/pages/repos.ejs`, {
              title: userUrl,
              profile: profileResult,
              user: userResult,
              repos: repoResult,
            });
          });
        } else {
          res.send("Kullanıcı Bulunamadı");
        }
      });
    });
  } else {
    Users.findOne({ url: userUrl }).then((profileResult) => {
      Repos.find({ userToken: profileResult.token })
        .then((repoResult) => {
          if (profileResult != null) {
            res.render(`${__dirname}/src/pages/repos.ejs`, {
              title: userUrl,
              profile: profileResult,
              user: false,
              repos: repoResult
            });
          }
        })
        .catch((err) => {
          res.send("Hata");
        });
    });
  }
});
//Repository Page
app.get('/s/:userUrl/:repoUrl',(req,res)=>{
  let token = req.cookies.token;
  if(token != null){
    Users.findOne({ token: token }).then((userResult)=>{
      Users.findOne({ url: req.params.userUrl }).then((profileResult)=>{
        Repos.findOne({ url: req.params.repoUrl}).then((repoResult)=>{
          Files.find({ repoToken: repoResult.token }).sort().then((fileResult)=>{
            res.render(`${__dirname}/src/pages/repository.ejs`,{
              title: repoResult.name,
              user: userResult,
              profile: profileResult,
              repo: repoResult,
              files: fileResult,
            })
          })
        })
      })
    })
  } else {
   Users.findOne({ url: req.params.userUrl }).then((profileResult)=>{
        Repos.findOne({ url: req.params.repoUrl}).then((repoResult)=>{
          Files.find({ repoToken: repoResult.token }).sort().then((fileResult)=>{
            res.render(`${__dirname}/src/pages/repository.ejs`,{
              title: repoResult.name,
              user: false,
              profile: profileResult,
              repo: repoResult,
              files: fileResult,
            })
          })
        })
      }) 
  }
})
//File page
app.get('/s/:userUrl/:repoUrl/:fileUrl/:fileId',(req,res)=>{
  let userUrl = req.params.userUrl;
  let repoUrl = req.params.repoUrl;
  let fileUrl = req.params.fileUrl;
  let fileId = req.params.fileId;
  let token = req.cookies.token;
  console.log(fileUrl)
  if(token != null){
   Users.findOne({ token: token }).then((userResult)=>{
    Users.findOne({ url: userUrl }).then((profileResult)=>{
    Repos.findOne({ userToken: profileResult.token }).then((repoResult)=>{
    Files.findById(fileId).then((fileResult)=>{
    let file = fileResult.file
    if(fileResult.fileOrString != "String"){
      fs.readFile(`${file}`, 'utf-8', (err, data)=>{
      res.render(`${__dirname}/src/pages/file.ejs`,{
      title: fileResult.filename,
      user: userResult,
      profile: profileResult,
      repo: repoResult,
      code: data,
      file: fileResult,
       }) 
      })
    } else {
    res.render(`${__dirname}/src/pages/file.ejs`,{
      title: fileResult.filename,
      user: userResult,
      profile: profileResult,
      repo: repoResult,
      code: fileResult.code,
      file:fileResult,
       })
      console.log("deneme")
      }
      })
     })
    })
   })
  } else {
    Users.findOne({ url: userUrl }).then((profileResult)=>{
    Repos.findOne({ userToken: profileResult.token }).then((repoResult)=>{
    Files.findById(fileId).then((fileResult)=>{
    let file = fileResult.file
    if(fileResult.fileOrString != "String"){
      fs.readFile(`${file}`, 'utf-8', (err, data)=>{
      res.render(`${__dirname}/src/pages/file.ejs`,{
      title: fileResult.filename,
      user: false,
      profile: profileResult,
      repo: repoResult,
      code: data,
      file: fileResult,
       }) 
      })
    } else {
    res.render(`${__dirname}/src/pages/file.ejs`,{
      title: fileResult.filename,
      user: false,
      profile: profileResult,
      repo: repoResult,
      code: fileResult.code,
      file:fileResult,
       })
      }
      })
     })
    }) 
  }
})
//Login
app.get("/login", (req, res) => {
  res.render(`${__dirname}/src/pages/login.ejs`, {
    title: "Giriş yap",
  });
});
//Register
app.get("/register", (req, res) => {
  res.render(`${__dirname}/src/pages/register.ejs`, {
    title: "Kayıt ol",
  });
});
//Forms
//Login
app.post("/login", (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let email = req.body.email;
  Users.findOne({
    username: username,
    password: password,
    email: email,
  }).then((userResult) => {
    res.cookie("token", userResult.token);
    res.cookie("url", userResult.url);
    res.cookie("username", userResult.username);
    res.redirect("/");
  });
});
//Register
app.post("/register", (req, res) => {
  let username = req.body.username;
  let email = req.body.email;
  Users.findOne({ username: username }, (user, err) => {
    if (user) {
      res.send(`Böyle bir kullanıcı var`);
    } else {
      let user = new Users({
        username: username,
        email: email,
        password: req.body.password,
        token: generate_token(24),
        url: generate_url(username),
        repostiories: [`${username}`],
        repositioriesCount: 1,
        followers: [],
        followersCount: 0,
        followed: [],
        followedCount: 0,
        badgets: [],
        pinned: [],
        profile_photo:
          "https://cdn.glitch.global/16e6c265-6e2e-47f7-98e5-c7dbcfecc2b1/eccfead4-4622-4b1f-aded-03cca5077885.image.png?v=1662498805096",
        about: "",
        stars: [],
        starsCount: 0,
        secret: generate_secret(42),
      });
      user.save().then((userResult) => {
        let repo = new Repos({
          name: userResult.url,
          url: userResult.url,
          userToken: userResult.token,
          stars: [],
          starCount: 0,
          token: generate_token(32),
        });
        repo.save().then((repoResult) => {
          let file = new Files({
            fileOrString: "String",
            filename: "ReadMe.md",
            url: userResult.url,
            code: `Merhaba ben ${userResult.username}`,
            repoToken: repoResult.token,
            token: generate_token(40),
          });
          file.save().then((redirect) => {
            res.cookie("token", userResult.token);
            res.cookie("url", userResult.url);
            res.cookie("username", userResult.username);
            res.cookie("secret", lang.convert(userResult.secret))
            res.redirect(`/s/${userResult.url}`);
          });
        });
      });
    }
  });
});
//Create Repository
//Page
app.get('/create/repository/:userToken',(req,res)=>{
  let token = req.cookies.token;
  let userToken = req.params.userToken;
  if(token == userToken){
    Users.findOne({ token: token }).then((userResult)=>{
    res.render(`${__dirname}/src/pages/create-repo.ejs`,{
      title: userResult.username,
      user: userResult,
      profile: userResult,
    })
  })
  } else {
    res.send("Güvenlik uyarısı")
  }
})
//Form
app.post("/create/repo/:userToken/", (req, res) => {
  let token = req.cookies.token;
  let userToken = req.params.userToken;
  if (token == userToken) {
  Users.findOne({ token: token }).then((userResult)=>{
    let repo = new Repos({
      name: req.body.name,
      description: req.body.description,
      stars: [],
      starCount: 0,
      forks: [],
      forkCount: 0,
      token: generate_token(24),
      url: generate_url(req.body.name),
      userToken: userToken,
      user: userResult.url,
    });
    repo.save().then((result) => {
    Users.findOne({ token: userToken }).then((userResult)=>{
      let repoCount = userResult.repositioriesCount;
      Users.findOneAndUpdate({ token: userToken },{
        repositioriesCount: Number(repoCount+1)
      }).then((redirect)=>{
        res.redirect(`/s/${userResult.url}/repos`);
      })
    })
  });
 })
  } else {
    res.send("HACI GUVENLIK UYARISI");
  }
});
//Edit Repository

//Archive Repository

//Delete Repository
app.post('/delete/repo/:repoToken',(req,res)=>{
  let token = req.cookies.token;
  let repoToken = req.params.repoToken;
  Repos.findOne({ token: repoToken }).then((repoResult)=>{
    if(repoResult.userToken == token){
      Repos.findOneAndDelete({ token: repoToken }).then((editUser)=>{
        Users.findOne({ token: token }).then((userResult)=>{
         let repoCount = userResult.repositioriesCount;  
          Users.findOneAndUpdate({ token: token },{
            repositioriesCount: Number(repoCount-1),
          }).then((deleteFiles)=>{
            Files.find({ repoToken: repoToken }).count().then((fileCount)=>{
              for(let i=0;i < fileCount;i++){
                Files.findOneAndDelete({ repoToken: repoToken }).then((result)=>{
                  console.log(`${i} Dosya silindi`)
                })
              }
            }).then((findUser)=>{
              Users.findOne({ token: token }).then((redirect)=>{
                res.redirect(`/s/${redirect.url}/repos`)
              })
            })
          })
        })
      })
    } else { 
     res.send("Güvenlik uyarısı")
    }
  })
})
//Create File
//Create file with file
//Page
app.get('/add/file/:userToken/:repoToken',(req,res)=>{
  let userToken = req.params.userToken;
  let token = req.cookies.token;
  let repoToken = req.params.repoToken
  if(userToken == token){
    Users.findOne({ token: token }).then((userResult)=>{
      Repos.findOne({ token: repoToken }).then((repoResult)=>{
      res.render(`${__dirname}/src/pages/add-file.ejs`,{
        title: userResult.username,
        user: userResult,
        profile: userResult,
        repo:repoResult,
       })
      })
    })
  } else {
    res.send("Güvenlik uyarısı")
  }
})
//Form
app.post("/add/file/:repoToken/withFile", upload_code.single("uploaded_file"), (req, res) => {
  let repoToken = req.params.repoToken;
  let token = req.cookies.token;
  let userUrl, repoUrl
  Repos.findOne({ token: repoToken }).then((repoResult)=>{
    if(repoResult.userToken == token){
      let file = new Files({
        fileOrString: "file",
        file: `./public/data/${req.file.filename}`,
        filename: req.body.filename,
        userToken: token,
        token: generate_token(42),
        url: generate_url(req.body.filename),
        username: generate_url(req.cookies.username),
        repoToken: repoToken
      })
      file.save().then((findUser)=>{
        Users.findOne({ token: token }).then((setUserUrl)=>{
          userUrl = setUserUrl.url
        }).then((setRepoUrl)=>{
          Repos.findOne({ token: repoToken }).then((repoResult)=>{
            repoUrl = repoResult.url
          }).then((redirect)=>{
            res.redirect(`/s/${userUrl}/${repoUrl}`)
          })
        })
      })
    } else {
      res.send("Güvenlik uyarısı")
    }
  })
});
//Create file without file
app.post("/add/file/:repoToken/withOutFile", (req, res) => {
  let repoToken = req.params.repoToken;
  let token = req.cookies.token;
  let userUrl, repoUrl
  Repos.findOne({ token: repoToken }).then((repoResult)=>{
    if(token == repoResult.userToken){
      let file = new Files({
        fileOrString: "String",
        filename: req.body.filename,
        userToken: token,
        repoToken: repoToken,
        url: generate_url(req.body.filename),
        username: generate_url(req.cookies.username),
        code: req.body.code,
      })
      file.save().then((findUser)=>{
        Users.findOne({ token: token }).then((getUrl)=>{
          userUrl = getUrl.url
        }).then((setRepoUrl)=>{
          Repos.findOne({ token: repoToken }).then((repoResult)=>{
            repoUrl = repoResult.url
          }).then((redirect)=>{
            res.redirect(`/s/${userUrl}/${repoUrl}`)
          })
        })
      })
    } else {
      res.send("Güvenlik uyarısı")
    }
  })
});
//Edit file
app.post('/edit/file/:fileToken',(req,res)=>{
  let token = req.cookies.token;
  let fileToken = req.params.fileToken;
  let userUrl, repoUrl, fileUrl, fileId
  Files.findOne({ token: fileToken }).then((fileResult)=>{
    fileUrl = fileResult.url;
    fileId = fileResult._id;
    Repos.findOne({ token: fileResult.repoToken }).then((repoResult)=>{
      repoUrl = repoResult.url;
      if(repoResult.userToken == token){
        Files.findOneAndUpdate({ token: fileToken },{
          fileOrString: "String",
          code: req.body.code,
        }).then((findUser)=>{
          Users.findOne({ token: token }).then((getUrl)=>{
            userUrl = getUrl.url;
          }).then((redirect)=>{
            res.redirect(`/s/${userUrl}/${repoUrl}/${fileUrl}/${fileId}`)
          })
        })
      } else {
        res.send("Güvenlik uyarısı")
      }
    })
  })
})
//Archive file

//Delete file
app.post('/delete/file/:fileId', (req,res)=>{
  let fileId = req.params.fileId;
  let token = req.cookies.token;
  let userUrl, repoUrl
  Files.findById(fileId).then((fileResult)=>{
    Repos.findOne({ token: fileResult.repoToken }).then((repoResult)=>{
      if(repoResult.userToken == token){
        Files.findByIdAndDelete(fileId).then((findRepo)=>{
          Repos.findOne({ token: fileResult.repoToken}).then((getUrl)=>{
            repoUrl = getUrl.url;
          }).then((findUser)=>{
            Users.findOne({token: token }).then((getUrl)=>{
              userUrl = getUrl.url;
            }).then((redirect)=>{
              res.redirect(`/s/${userUrl}/${repoUrl}`)
            })
          })
        })
      } else {
        res.send("Güvenlik uyarısı")
      }
    })
  })
})
//Edit Profile
app.post("/edit/profile/:token", (req, res) => {
  Users.findOneAndUpdate({ token: req.params.token },{
      bio: req.body.bio,
    }).then((redirect) => {
    res.redirect(`/s/${redirect.url}`);
  });
});
//Change Profile photo

//Follow user
app.post('/follow/user/:userId/:userUrl',(req,res)=>{
  let token = req.cookies.token;
  let userToken = req.params.userId;
  let userUrl = req.params.userUrl;
  let followingCount, followerCount, yourToken
  Users.findOne({ token: token }).then((userResult)=>{
    followingCount = userResult.followedCount;
    yourToken = userResult._id;
  }).then((findProfile)=>{
    Users.findById(userToken).then((profileResult)=>{
     followerCount = profileResult.followersCount;
    }).then((updateUser)=>{
      Users.findByIdAndUpdate(userToken,{
        followersCount: Number(followerCount)+1,
        $push: { followers: yourToken },
      }).then((editYourProfile)=>{
        Users.findOneAndUpdate({ token: token },{
          followedCount: Number(followingCount)+1,
          $push: { followed: userToken }    
        }).then((redirect)=>{
          res.redirect(`/s/${userUrl}`);
        })
      })
    })
  })
})
//Unfollow user
app.post('/unfollow/user/:userId/:userUrl',(req,res)=>{
  let token = req.cookies.token;
  let userToken = req.params.userId;
  let userUrl = req.params.userUrl;
  let followingCount, followerCount, yourToken
  Users.findOne({ token: token }).then((userResult)=>{
    followingCount = userResult.followedCount;
    yourToken = userResult._id;
  }).then((findProfile)=>{
    Users.findById(userToken).then((profileResult)=>{
     followerCount = profileResult.followersCount;
    }).then((updateUser)=>{
      Users.findByIdAndUpdate(userToken,{
        followersCount: Number(followerCount)-1,
        $pull: { followers: yourToken },
      }).then((editYourProfile)=>{
        Users.findOneAndUpdate({ token: token },{
          followedCount: Number(followingCount)-1,
          $pull: { followed: userToken }    
        }).then((redirect)=>{
          res.redirect(`/s/${userUrl}`);
        })
      })
    })
  })
})
//Star repo
app.post('/star/repository/:repoId/:profileUrl',(req,res)=>{
 let token = req.cookies.token;
 let repoToken = req.params.repoId;
 let profileUrl = req.params.profileUrl
 let repoId
 Repos.findById(repoToken).then((repoResult)=>{
   let starCount = repoResult.starCount;
   repoId: repoResult._id
   Repos.findByIdAndUpdate(repoToken,{
     starCount: Number(starCount)+1,
   }).then((findUser)=>{
     Users.findOne({ token: token }).then((userResult)=>{
      let userStarCount = userResult.starsCount;
      Users.findOneAndUpdate({ token: token },{
        $push: { stars: repoToken },
        starsCount: Number(userStarCount)+1
      }).then((findProfile)=>{
        Users.findOne({ url: profileUrl }).then((redirect)=>{
          res.redirect(`/s/${redirect.url}/repos`)
        })
      })
     })
   })
 })
})
//Unstar repo
app.post('/unstar/repository/:repoId/:profileUrl',(req,res)=>{
 let token = req.cookies.token;
 let repoToken = req.params.repoId;
 let profileUrl = req.params.profileUrl
 let repoId
 Repos.findById(repoToken).then((repoResult)=>{
   let starCount = repoResult.starCount;
   repoId: repoResult._id
   Repos.findByIdAndUpdate(repoToken,{
     starCount: Number(starCount-1),
   }).then((findUser)=>{
     Users.findOne({ token: token }).then((userResult)=>{
      let userStarCount = userResult.starsCount;
      Users.findOneAndUpdate({ token: token },{
        $pull:{ stars: repoToken},
        starsCount: Number(userStarCount-1),
      }).then((findProfile)=>{
        Users.findOne({ url: profileUrl }).then((redirect)=>{
          res.redirect(`/s/${redirect.url}/repos`)
        })
      })
     })
   })
 })
})
