let skip = 0;

document.addEventListener("click", function (event) {
  if (event.target.classList.contains("add_item")) {
    event.preventDefault();

    const todoText = document.getElementById("create_field");

    if (todoText.value === "") {
      alert("Please enter todo text");
      return;
    }

    axios
      .post("/create-item", { todo: todoText.value })
      .then((res) => {
        console.log(res);
        if (res.data.status !== 201) {
          alert(res.data.message);
          return;
        }
        todoText.value = "";
      })
      .catch((err) => {
        console.log(err);
        alert(err);
      });
  }

  if (event.target.classList.contains("edit-me")) {
    console.log("edited");
    const id = event.target.getAttribute("data-id");
    const newData = prompt("Enter your new todo text");

    console.log(id, newData);
    axios
      .post("/edit-item", { id, newData })
      .then((res) => {
        console.log(res);
        if (res.data.status !== 201) {
          alert(res.data.message);
          return;
        }

        event.target.parentElement.parentElement.querySelector(
          ".item-text"
        ).innerHTML = newData;
        return;
      })
      .catch((err) => {
        console.log(err);
      });
  }

  if (event.target.classList.contains("delete-me")) {
    const id = event.target.getAttribute("data-id");

    axios
      .post("/delete-item", { id })
      .then((res) => {
        console.log(res);
        if (res.data.status !== 200) {
          alert(res.data.message);
          return;
        }

        event.target.parentElement.parentElement.remove();
        return;
      })
      .catch((err) => {
        console.log(err);
      });
  }

  if (event.target.classList.contains("show_more")) {
    generateTodos();
  }
});

window.onload = function () {
  generateTodos();
};

function generateTodos() {
  axios
    .get(`/pagination_dashboard?skip=${skip}`)
    .then((res) => {
      console.log(res.data.data);
      let todos = res.data.data[0].data;

      if (todos.length === 0) {
        alert("No more todos, please create some");
      }

      document.getElementById("item_list").insertAdjacentHTML(
        "beforeend",
        todos
          .map((item) => {
            return ` <li class="list-group-item list-group-item-action d-flex align-items-center justify-content-between">
          <span class="item-text"> ${item.todo}  </span>
          <div>
          <button data-id="${item._id}" class="edit-me btn btn-secondary btn-sm mr-1">Edit</button>
          <button data-id="${item._id}" class="delete-me btn btn-danger btn-sm">Delete</button>
      </div>
      </li>`;
          })
          .join("")
      );

      skip += todos.length;

      return;
    })
    .catch((err) => {
      alert(err);
      console.log(err);
      return;
    });
}

//client(axios) <---APIs--->backend(routes) <---> Database
